from django.utils import timezone
from rest_framework import status

from fleet.models import Vehicle

from .base import AuthenticatedAPITestCase
from .factories import make_office, make_vehicle

VALID_VIN = "1HGCM82633A004352"


class VehicleCrudTests(AuthenticatedAPITestCase):
    url = "/api/vehicles/"

    def setUp(self):
        self.office = make_office(name="Denver Office")

    def payload(self, **overrides):
        return {
            "vin": VALID_VIN,
            "license_plate": "ABC-1234",
            "make": "Ford",
            "model": "Transit",
            "year": 2022,
            "office": self.office.pk,
        } | overrides

    def test_create_normalizes_identifiers_and_returns_office_name(self):
        response = self.client.post(
            self.url,
            self.payload(vin=VALID_VIN.lower(), license_plate="  abc-1234 "),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["vin"], VALID_VIN)
        self.assertEqual(response.data["license_plate"], "ABC-1234")
        self.assertEqual(response.data["office_name"], "Denver Office")
        self.assertTrue(response.data["is_active"])

    def test_invalid_fields_return_meaningful_messages(self):
        response = self.client.post(
            self.url,
            self.payload(vin="NOT-A-VIN", year=1900, office=999999),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("17 characters", str(response.data["vin"][0]))
        self.assertIn("Year must be between", str(response.data["year"][0]))
        self.assertIn("office", response.data)

    def test_duplicate_vin_is_rejected(self):
        make_vehicle(vin=VALID_VIN)

        response = self.client.post(self.url, self.payload(), format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            response.data["vin"], ["A vehicle with this VIN already exists."]
        )

    def test_plate_of_active_vehicle_is_rejected(self):
        make_vehicle(license_plate="ABC-1234")

        response = self.client.post(self.url, self.payload(), format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            response.data["license_plate"],
            ["An active vehicle with this license plate already exists."],
        )

    def test_plate_of_retired_vehicle_can_be_reused(self):
        make_vehicle(license_plate="ABC-1234", is_active=False)

        response = self.client.post(self.url, self.payload(), format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_inactive_vehicle_may_be_created_with_an_active_plate(self):
        make_vehicle(license_plate="ABC-1234")

        response = self.client.post(
            self.url, self.payload(is_active=False), format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_reactivating_vehicle_with_taken_plate_is_rejected(self):
        make_vehicle(license_plate="ABC-1234")
        retired = make_vehicle(license_plate="ABC-1234", is_active=False)

        response = self.client.patch(
            f"{self.url}{retired.pk}/", {"is_active": True}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("license_plate", response.data)

    def test_updating_vehicle_does_not_conflict_with_itself(self):
        vehicle = make_vehicle(license_plate="ABC-1234")

        response = self.client.patch(
            f"{self.url}{vehicle.pk}/", {"license_plate": "abc-1234", "year": 2021},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["year"], 2021)

    def test_year_may_be_next_model_year(self):
        response = self.client.post(
            self.url, self.payload(year=timezone.localdate().year + 1), format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_delete(self):
        vehicle = make_vehicle()

        response = self.client.delete(f"{self.url}{vehicle.pk}/")

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Vehicle.objects.filter(pk=vehicle.pk).exists())
