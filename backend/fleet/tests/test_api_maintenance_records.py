from datetime import date, timedelta
from decimal import Decimal

from django.utils import timezone
from rest_framework import status

from .base import AuthenticatedAPITestCase
from .factories import make_mechanic, make_record, make_vehicle


class MaintenanceRecordApiTests(AuthenticatedAPITestCase):
    url = "/api/maintenance-records/"

    def setUp(self):
        self.vehicle = make_vehicle(license_plate="FLT-0001")
        self.mechanic = make_mechanic(name="Ana Lopez")

    def payload(self, **overrides):
        return {
            "vehicle": self.vehicle.pk,
            "mechanic": self.mechanic.pk,
            "date": "2025-03-10",
            "maintenance_type": "brakes",
            "cost": "450.75",
            "notes": "Front pads replaced.",
        } | overrides

    def test_create_returns_display_fields(self):
        response = self.client.post(self.url, self.payload(), format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["vehicle_license_plate"], "FLT-0001")
        self.assertEqual(response.data["mechanic_name"], "Ana Lopez")
        self.assertEqual(response.data["cost"], Decimal("450.75"))

    def test_rejects_future_date_negative_cost_and_unknown_type(self):
        in_two_days = (timezone.localdate() + timedelta(days=2)).isoformat()

        response = self.client.post(
            self.url,
            self.payload(date=in_two_days, cost="-5", maintenance_type="teleport"),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            response.data["date"], ["Maintenance date cannot be in the future."]
        )
        self.assertIn("cost", response.data)
        self.assertIn("maintenance_type", response.data)

    def test_tomorrow_is_accepted_for_users_ahead_of_server_time(self):
        tomorrow = (timezone.localdate() + timedelta(days=1)).isoformat()

        response = self.client.post(self.url, self.payload(date=tomorrow), format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_rejects_inactive_mechanic_for_new_record(self):
        retired = make_mechanic(is_active=False)

        response = self.client.post(
            self.url, self.payload(mechanic=retired.pk), format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("inactive mechanic", str(response.data["mechanic"][0]))

    def test_existing_record_of_departed_mechanic_stays_editable(self):
        record = make_record(vehicle=self.vehicle, mechanic=self.mechanic)
        self.mechanic.is_active = False
        self.mechanic.save()

        response = self.client.patch(
            f"{self.url}{record.pk}/",
            {"mechanic": self.mechanic.pk, "notes": "Corrected notes"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["notes"], "Corrected notes")

    def test_filter_by_vehicle(self):
        make_record(vehicle=self.vehicle)
        make_record()

        response = self.client.get(self.url, {"vehicle": self.vehicle.pk})

        self.assertEqual(response.data["count"], 1)

    def test_list_is_newest_first(self):
        make_record(vehicle=self.vehicle, date=date(2024, 1, 1))
        make_record(vehicle=self.vehicle, date=date(2025, 1, 1))

        response = self.client.get(self.url)

        dates = [row["date"] for row in response.data["results"]]
        self.assertEqual(dates, ["2025-01-01", "2024-01-01"])

    def test_delete(self):
        record = make_record()

        response = self.client.delete(f"{self.url}{record.pk}/")

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
