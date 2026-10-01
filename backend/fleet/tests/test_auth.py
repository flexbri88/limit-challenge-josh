from datetime import timedelta

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import AccessToken

from fleet.models import Mechanic, Office

from .factories import make_office, make_record, make_vehicle

PASSWORD = "correct horse battery staple"


class AuthTestCase(APITestCase):
    """Uses real tokens, unlike the other API tests (see base.SignedInClient)."""

    token_url = "/api/auth/token/"
    refresh_url = "/api/auth/token/refresh/"
    logout_url = "/api/auth/logout/"

    @classmethod
    def setUpTestData(cls):
        cls.user = get_user_model().objects.create_user(
            username="dispatcher", password=PASSWORD, first_name="Dana", last_name="Lee"
        )

    def obtain(self, username="dispatcher", password=PASSWORD):
        return self.client.post(
            self.token_url, {"username": username, "password": password}, format="json"
        )

    def use(self, access):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")


class ProtectedEndpointTests(AuthTestCase):
    def test_every_endpoint_rejects_anonymous_requests(self):
        record = make_record()
        vehicle, mechanic, office = record.vehicle, record.mechanic, record.vehicle.office
        requests = [
            ("get", "/api/"),
            ("get", "/api/auth/me/"),
            ("get", "/api/offices/"),
            ("get", f"/api/offices/{office.pk}/"),
            ("get", "/api/offices/summary/"),
            ("delete", f"/api/offices/{office.pk}/"),
            ("get", "/api/mechanics/"),
            ("get", "/api/mechanics/workload/"),
            ("patch", f"/api/mechanics/{mechanic.pk}/"),
            ("get", "/api/vehicles/"),
            ("post", "/api/vehicles/"),
            ("get", f"/api/vehicles/{vehicle.pk}/"),
            ("get", f"/api/vehicles/{vehicle.pk}/maintenance-history/"),
            ("post", f"/api/vehicles/{vehicle.pk}/assign/"),
            ("get", "/api/vehicles/needs-maintenance/"),
            ("get", "/api/vehicles/check-duplicate/?vin=X"),
            ("get", "/api/maintenance-records/"),
            ("put", f"/api/maintenance-records/{record.pk}/"),
        ]
        for method, url in requests:
            with self.subTest(method=method, url=url):
                response = getattr(self.client, method)(url)
                self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
                self.assertEqual(response["WWW-Authenticate"], 'Bearer realm="api"')

    def test_rejected_write_changes_nothing(self):
        office = make_office()
        make_vehicle(office=office)

        self.client.delete(f"/api/offices/{office.pk}/")
        self.client.post("/api/mechanics/", {"name": "X", "certification_number": "C-1"})

        self.assertTrue(Office.objects.filter(pk=office.pk).exists())
        self.assertFalse(Mechanic.objects.filter(name="X").exists())

    def test_malformed_or_foreign_tokens_are_rejected(self):
        forged = AccessToken.for_user(self.user)
        forged_string = str(forged)[:-4] + "AAAA"  # breaks the signature
        for header in ["Bearer not-a-jwt", f"Bearer {forged_string}", "Token abc"]:
            with self.subTest(header=header):
                self.client.credentials(HTTP_AUTHORIZATION=header)
                response = self.client.get("/api/vehicles/")
                self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_expired_access_token_is_rejected(self):
        token = AccessToken.for_user(self.user)
        token.set_exp(lifetime=-timedelta(seconds=1))
        self.use(token)

        response = self.client.get("/api/vehicles/")

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(response.data["code"], "token_not_valid")

    def test_token_of_a_deactivated_user_is_rejected(self):
        access = self.obtain().data["access"]
        self.user.is_active = False
        self.user.save()
        self.use(access)

        response = self.client.get("/api/vehicles/")

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_browsable_api_accepts_a_session_login(self):
        self.client.login(username="dispatcher", password=PASSWORD)

        response = self.client.get("/api/vehicles/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)


class TokenFlowTests(AuthTestCase):
    def test_login_returns_tokens_that_grant_access(self):
        response = self.obtain()

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(set(response.data), {"access", "refresh"})
        self.use(response.data["access"])
        self.assertEqual(self.client.get("/api/vehicles/").status_code, status.HTTP_200_OK)

    def test_login_records_last_login(self):
        self.obtain()

        self.user.refresh_from_db()
        self.assertIsNotNone(self.user.last_login)

    def test_wrong_credentials_are_rejected_without_saying_which_part(self):
        for username, password in [("dispatcher", "wrong"), ("nobody", PASSWORD)]:
            with self.subTest(username=username):
                response = self.obtain(username, password)
                self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
                self.assertEqual(
                    response.data["detail"],
                    "No active account found with the given credentials",
                )

    def test_inactive_user_cannot_log_in(self):
        self.user.is_active = False
        self.user.save()

        self.assertEqual(self.obtain().status_code, status.HTTP_401_UNAUTHORIZED)

    def test_missing_fields_are_field_errors(self):
        response = self.client.post(self.token_url, {}, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(set(response.data), {"username", "password"})

    def test_current_user(self):
        self.use(self.obtain().data["access"])

        response = self.client.get("/api/auth/me/")

        self.assertEqual(
            response.data,
            {"id": self.user.pk, "username": "dispatcher", "full_name": "Dana Lee"},
        )

    def test_refresh_rotates_and_the_old_refresh_token_stops_working(self):
        refresh = self.obtain().data["refresh"]

        response = self.client.post(self.refresh_url, {"refresh": refresh}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(set(response.data), {"access", "refresh"})
        self.assertNotEqual(response.data["refresh"], refresh)
        self.use(response.data["access"])
        self.assertEqual(self.client.get("/api/vehicles/").status_code, status.HTTP_200_OK)

        self.client.credentials()
        reused = self.client.post(self.refresh_url, {"refresh": refresh}, format="json")
        self.assertEqual(reused.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_access_token_cannot_be_used_as_refresh_token(self):
        access = self.obtain().data["access"]

        response = self.client.post(self.refresh_url, {"refresh": access}, format="json")

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_logout_revokes_the_refresh_token(self):
        refresh = self.obtain().data["refresh"]

        response = self.client.post(self.logout_url, {"refresh": refresh}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        after = self.client.post(self.refresh_url, {"refresh": refresh}, format="json")
        self.assertEqual(after.status_code, status.HTTP_401_UNAUTHORIZED)
