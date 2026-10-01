from datetime import date, timedelta
from decimal import Decimal

from rest_framework import status

from fleet.models import MaintenanceRecord

from .base import AuthenticatedAPITestCase
from .factories import make_mechanic, make_office, make_record, make_vehicle


class VehicleDetailTests(AuthenticatedAPITestCase):
    def setUp(self):
        self.office = make_office(name="Denver", city="Denver")
        self.vehicle = make_vehicle(office=self.office)
        self.mechanic = make_mechanic(name="Ana Lopez", certification_number="ASE-1")

    def url(self, vehicle=None):
        return f"/api/vehicles/{(vehicle or self.vehicle).pk}/"

    def test_includes_office_history_mechanics_and_summary(self):
        make_record(
            vehicle=self.vehicle, mechanic=self.mechanic,
            date=date(2024, 5, 1), cost=Decimal("100.00"),
        )
        make_record(
            vehicle=self.vehicle, mechanic=self.mechanic,
            date=date(2025, 5, 1), cost=Decimal("250.50"),
            maintenance_type=MaintenanceRecord.MaintenanceType.BRAKES,
        )

        data = self.client.get(self.url()).data

        self.assertEqual(
            data["office_detail"],
            {"id": self.office.pk, "name": "Denver", "city": "Denver"},
        )
        self.assertEqual(data["maintenance_count"], 2)
        self.assertEqual(data["total_maintenance_cost"], Decimal("350.50"))
        self.assertEqual(data["last_maintenance"], date(2025, 5, 1))

        newest = data["maintenance_records"][0]
        self.assertEqual(newest["date"], "2025-05-01")
        self.assertEqual(newest["maintenance_type_display"], "Brakes")
        self.assertEqual(newest["mechanic"]["name"], "Ana Lopez")
        self.assertEqual(newest["mechanic"]["certification_number"], "ASE-1")

    def test_vehicle_without_history(self):
        data = self.client.get(self.url()).data

        self.assertEqual(data["maintenance_records"], [])
        self.assertEqual(data["maintenance_count"], 0)
        self.assertIsNone(data["last_maintenance"])

    def test_query_count_does_not_grow_with_history(self):
        mechanics = [make_mechanic() for _ in range(20)]
        MaintenanceRecord.objects.bulk_create(
            MaintenanceRecord(
                vehicle=self.vehicle,
                mechanic=mechanics[i % len(mechanics)],
                date=date(2025, 1, 1) - timedelta(days=i),
                maintenance_type=MaintenanceRecord.MaintenanceType.INSPECTION,
                cost=Decimal("80.00"),
            )
            for i in range(300)
        )

        # 1: vehicle + office (select_related), 2: records + mechanics (prefetch).
        with self.assertNumQueries(2):
            response = self.client.get(self.url())

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["maintenance_records"]), 300)

    def test_list_stays_lightweight(self):
        make_record(vehicle=self.vehicle)

        row = self.client.get("/api/vehicles/").data["results"][0]

        self.assertNotIn("maintenance_records", row)
        self.assertEqual(row["office_name"], "Denver")
