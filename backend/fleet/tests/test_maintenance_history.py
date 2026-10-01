from datetime import date

from rest_framework import status

from .base import AuthenticatedAPITestCase
from .factories import make_record, make_vehicle


class MaintenanceHistoryTests(AuthenticatedAPITestCase):
    def setUp(self):
        self.vehicle = make_vehicle()
        self.url = f"/api/vehicles/{self.vehicle.pk}/maintenance-history/"

    def test_returns_only_this_vehicles_records_newest_first(self):
        oldest = make_record(vehicle=self.vehicle, date=date(2023, 3, 1))
        newest = make_record(vehicle=self.vehicle, date=date(2025, 3, 1))
        middle = make_record(vehicle=self.vehicle, date=date(2024, 3, 1))
        make_record(date=date(2025, 6, 1))  # another vehicle

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 3)
        self.assertEqual(
            [row["id"] for row in response.data["results"]],
            [newest.pk, middle.pk, oldest.pk],
        )
        self.assertIn("name", response.data["results"][0]["mechanic"])

    def test_same_day_records_are_ordered_by_most_recently_entered(self):
        first = make_record(vehicle=self.vehicle, date=date(2025, 3, 1))
        second = make_record(vehicle=self.vehicle, date=date(2025, 3, 1))

        results = self.client.get(self.url).data["results"]

        self.assertEqual([row["id"] for row in results], [second.pk, first.pk])

    def test_is_paginated(self):
        for day in range(1, 26):
            make_record(vehicle=self.vehicle, date=date(2025, 1, day))

        response = self.client.get(self.url, {"page": 2, "page_size": 10})

        self.assertEqual(response.data["count"], 25)
        self.assertEqual(response.data["results"][0]["date"], "2025-01-15")

    def test_unknown_vehicle_returns_404(self):
        response = self.client.get("/api/vehicles/999999/maintenance-history/")

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
