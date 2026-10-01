from unittest.mock import patch

from django.db import IntegrityError
from rest_framework import status

from fleet.exceptions import api_exception_handler
from fleet.models import Office
from fleet.serializers import VehicleSerializer

from .base import AuthenticatedAPITestCase
from .factories import make_mechanic, make_office, make_record, make_vehicle


class ProtectedDeleteTests(AuthenticatedAPITestCase):
    def test_office_with_vehicles_cannot_be_deleted(self):
        office = make_office()
        make_vehicle(office=office)
        make_vehicle(office=office)

        response = self.client.delete(f"/api/offices/{office.pk}/")

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(
            response.data["detail"],
            "Cannot delete this item because it is still referenced by 2 vehicles.",
        )
        self.assertTrue(Office.objects.filter(pk=office.pk).exists())

    def test_mechanic_with_history_cannot_be_deleted(self):
        mechanic = make_mechanic()
        make_record(mechanic=mechanic)

        response = self.client.delete(f"/api/mechanics/{mechanic.pk}/")

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertIn("1 maintenance record.", response.data["detail"])

    def test_deleting_vehicle_removes_its_history(self):
        record = make_record()

        response = self.client.delete(f"/api/vehicles/{record.vehicle_id}/")

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)


class FormEncodedInputTests(AuthenticatedAPITestCase):
    """The browsable API and curl -d/-F clients send QueryDicts, not JSON."""

    def test_vehicle_can_be_created_from_multipart_form_data(self):
        office = make_office()

        response = self.client.post(
            "/api/vehicles/",
            {
                "vin": "1hgcm82633a004352",
                "license_plate": "abc 123",
                "make": "Ford",
                "model": "Transit",
                "year": "2022",
                "office": str(office.pk),
            },
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data["vin"], "1HGCM82633A004352")
        self.assertEqual(response.data["license_plate"], "ABC 123")

    def test_mechanic_can_be_created_from_multipart_form_data(self):
        response = self.client.post(
            "/api/mechanics/", {"name": "Ana", "certification_number": "ase-9"}
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data["certification_number"], "ASE-9")


class InvalidQueryParameterTests(AuthenticatedAPITestCase):
    def test_unknown_boolean_value_is_rejected_instead_of_ignored(self):
        for url in ["/api/vehicles/", "/api/mechanics/", "/api/vehicles/needs-maintenance/"]:
            with self.subTest(url=url):
                response = self.client.get(url, {"is_active": "maybe"})

                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertIn("is_active", response.data)

    def test_page_past_the_end_is_a_404(self):
        response = self.client.get("/api/offices/", {"page": 99})

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class IntegrityErrorMappingTests(AuthenticatedAPITestCase):
    def test_duplicate_that_slips_past_validation_is_a_409(self):
        # Simulates two requests racing: both pass validation, the second
        # insert hits the partial unique index.
        make_vehicle(license_plate="RACE-1")
        payload = {
            "vin": "1HGCM82633A004352",
            "license_plate": "RACE-1",
            "make": "Ford",
            "model": "Transit",
            "year": 2022,
            "office": make_office().pk,
        }

        with patch.object(VehicleSerializer, "validate", lambda self, attrs: attrs):
            response = self.client.post("/api/vehicles/", payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertIn("Refresh and try again", response.data["detail"])

    def test_other_integrity_errors_are_not_disguised_as_conflicts(self):
        error = IntegrityError("NOT NULL constraint failed: fleet_vehicle.make")

        self.assertIsNone(api_exception_handler(error, {}))
