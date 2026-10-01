from django.db import connection
from django.test.utils import CaptureQueriesContext
from rest_framework import status

from .base import AuthenticatedAPITestCase
from .factories import make_office, make_vehicle


class AssignVehicleTests(AuthenticatedAPITestCase):
    def setUp(self):
        self.denver = make_office(name="Denver")
        self.austin = make_office(name="Austin")
        self.vehicle = make_vehicle(office=self.denver)
        self.url = f"/api/vehicles/{self.vehicle.pk}/assign/"

    def test_moves_vehicle_to_new_office(self):
        response = self.client.post(self.url, {"office": self.austin.pk}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["office"], self.austin.pk)
        self.assertEqual(response.data["office_name"], "Austin")
        self.vehicle.refresh_from_db()
        self.assertEqual(self.vehicle.office, self.austin)

    def test_only_the_office_column_is_written(self):
        with CaptureQueriesContext(connection) as ctx:
            self.client.post(self.url, {"office": self.austin.pk}, format="json")

        updates = [q["sql"] for q in ctx.captured_queries if q["sql"].startswith("UPDATE")]
        self.assertEqual(len(updates), 1)
        set_clause = updates[0].split(" SET ")[1].split(" WHERE ")[0]
        self.assertEqual(set_clause.count("="), 1)
        self.assertIn('"office_id"', set_clause)

    def test_same_office_is_rejected(self):
        response = self.client.post(self.url, {"office": self.denver.pk}, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            response.data["office"], ["Vehicle is already assigned to this office."]
        )

    def test_missing_or_unknown_office_is_rejected(self):
        for payload in [{}, {"office": 999999}]:
            with self.subTest(payload=payload):
                response = self.client.post(self.url, payload, format="json")
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertIn("office", response.data)

    def test_unknown_vehicle_returns_404(self):
        response = self.client.post(
            "/api/vehicles/999999/assign/", {"office": self.austin.pk}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_get_is_not_allowed(self):
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
