from rest_framework import status

from .base import AuthenticatedAPITestCase
from .factories import make_vehicle

VIN = "1HGCM82633A004352"


class DuplicateCheckTests(AuthenticatedAPITestCase):
    url = "/api/vehicles/check-duplicate/"

    def conflicts(self, **params):
        response = self.client.get(self.url, params)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        return response.data["conflicts"]

    def test_no_conflicts(self):
        make_vehicle()

        self.assertEqual(self.conflicts(vin=VIN, license_plate="NEW-001"), [])

    def test_vin_conflict(self):
        make_vehicle(vin=VIN)

        self.assertEqual(self.conflicts(vin=VIN, license_plate="NEW-001"), ["vin"])

    def test_plate_conflict_with_active_vehicle(self):
        make_vehicle(license_plate="ABC-123")

        self.assertEqual(
            self.conflicts(vin=VIN, license_plate="ABC-123"), ["license_plate"]
        )

    def test_both_fields_conflict_in_documented_order(self):
        make_vehicle(vin=VIN)
        make_vehicle(license_plate="ABC-123")

        self.assertEqual(
            self.conflicts(vin=VIN, license_plate="ABC-123"), ["vin", "license_plate"]
        )

    def test_retired_vehicle_plate_is_not_a_conflict(self):
        make_vehicle(license_plate="ABC-123", is_active=False)

        self.assertEqual(self.conflicts(license_plate="ABC-123"), [])

    def test_plate_does_not_conflict_for_an_inactive_candidate(self):
        make_vehicle(license_plate="ABC-123")

        self.assertEqual(self.conflicts(license_plate="ABC-123", is_active="false"), [])

    def test_inputs_are_normalized(self):
        make_vehicle(vin=VIN, license_plate="ABC 123")

        self.assertEqual(
            self.conflicts(vin=VIN.lower(), license_plate=" abc  123 "),
            ["vin", "license_plate"],
        )

    def test_vehicle_being_edited_is_excluded(self):
        vehicle = make_vehicle(vin=VIN, license_plate="ABC-123")

        self.assertEqual(
            self.conflicts(vin=VIN, license_plate="ABC-123", exclude=vehicle.pk), []
        )

    def test_runs_a_single_query(self):
        make_vehicle(vin=VIN)

        with self.assertNumQueries(1):
            self.client.get(self.url, {"vin": VIN, "license_plate": "ABC-123"})

    def test_requires_vin_or_plate(self):
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            response.data["non_field_errors"], ["Provide vin, license_plate or both."]
        )
