from datetime import date, timedelta
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone
from rest_framework import status

from fleet import reports

from .base import AuthenticatedAPITestCase
from .factories import make_mechanic, make_office, make_record, make_vehicle

TODAY = date(2025, 6, 15)


class OneYearBeforeTests(TestCase):
    def test_regular_date(self):
        self.assertEqual(reports.one_year_before(date(2025, 6, 15)), date(2024, 6, 15))

    def test_leap_day(self):
        self.assertEqual(reports.one_year_before(date(2024, 2, 29)), date(2023, 2, 28))


class OfficeSummaryTests(TestCase):
    def summary(self):
        return {office.name: office for office in reports.office_summary(TODAY)}

    def test_aggregates_per_office(self):
        denver = make_office(name="Denver")
        van = make_vehicle(office=denver)
        truck = make_vehicle(office=denver)
        make_vehicle(office=denver, is_active=False)
        # Several records per vehicle must not inflate the vehicle count or costs.
        make_record(vehicle=van, date=date(2025, 6, 1), cost=Decimal("100.00"))
        make_record(vehicle=van, date=date(2025, 1, 1), cost=Decimal("200.00"))
        make_record(vehicle=truck, date=date(2024, 9, 1), cost=Decimal("50.25"))
        make_record(vehicle=truck, date=date(2023, 1, 1), cost=Decimal("999.00"))

        denver_row = self.summary()["Denver"]

        self.assertEqual(denver_row.active_vehicle_count, 2)
        self.assertEqual(denver_row.maintenance_cost_last_year, Decimal("350.25"))
        self.assertEqual(denver_row.last_maintenance, date(2025, 6, 1))

    def test_window_includes_exactly_one_year_ago(self):
        vehicle = make_vehicle(office=make_office(name="Austin"))
        make_record(vehicle=vehicle, date=date(2024, 6, 15), cost=Decimal("10.00"))
        make_record(vehicle=vehicle, date=date(2024, 6, 14), cost=Decimal("99.00"))

        self.assertEqual(
            self.summary()["Austin"].maintenance_cost_last_year, Decimal("10.00")
        )

    def test_inactive_vehicles_count_toward_cost_and_last_maintenance(self):
        vehicle = make_vehicle(office=make_office(name="Austin"), is_active=False)
        make_record(vehicle=vehicle, date=date(2025, 5, 1), cost=Decimal("40.00"))

        row = self.summary()["Austin"]

        self.assertEqual(row.active_vehicle_count, 0)
        self.assertEqual(row.maintenance_cost_last_year, Decimal("40.00"))
        self.assertEqual(row.last_maintenance, date(2025, 5, 1))

    def test_office_without_vehicles_has_zero_values(self):
        make_office(name="Empty")

        row = self.summary()["Empty"]

        self.assertEqual(row.active_vehicle_count, 0)
        self.assertEqual(row.maintenance_cost_last_year, Decimal("0"))
        self.assertIsNone(row.last_maintenance)


class OfficeSummaryEndpointTests(AuthenticatedAPITestCase):
    def test_returns_unpaginated_list_in_documented_shape(self):
        office = make_office(name="New York", city="New York")
        make_record(
            vehicle=make_vehicle(office=office),
            date=timezone.localdate() - timedelta(days=3),
            cost=Decimal("81250.50"),
        )
        make_office(name="Boston")

        with self.assertNumQueries(1):
            response = self.client.get("/api/offices/summary/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([row["name"] for row in response.data], ["Boston", "New York"])
        self.assertEqual(
            response.json()[1],
            {
                "id": office.pk,
                "name": "New York",
                "city": "New York",
                "active_vehicle_count": 1,
                "maintenance_cost_last_year": 81250.5,
                "last_maintenance": (timezone.localdate() - timedelta(days=3)).isoformat(),
            },
        )


class MechanicWorkloadTests(TestCase):
    def test_counts_only_current_year_and_orders_busiest_first(self):
        alice = make_mechanic(name="Alice")
        bob = make_mechanic(name="Bob")
        make_mechanic(name="Idle")
        make_record(mechanic=alice, date=date(2025, 1, 1), cost=Decimal("100.00"))
        make_record(mechanic=bob, date=date(2025, 2, 1), cost=Decimal("10.00"))
        make_record(mechanic=bob, date=date(2025, 6, 15), cost=Decimal("20.00"))
        make_record(mechanic=alice, date=date(2024, 12, 31), cost=Decimal("5000.00"))

        rows = [
            (m.name, m.maintenance_count, m.total_maintenance_cost)
            for m in reports.mechanic_workload(TODAY)
        ]

        self.assertEqual(
            rows,
            [
                ("Bob", 2, Decimal("30.00")),
                ("Alice", 1, Decimal("100.00")),
                ("Idle", 0, Decimal("0")),
            ],
        )

    def test_ties_are_broken_by_cost(self):
        cheap = make_mechanic(name="Cheap")
        pricey = make_mechanic(name="Pricey")
        make_record(mechanic=cheap, date=date(2025, 3, 1), cost=Decimal("10.00"))
        make_record(mechanic=pricey, date=date(2025, 3, 1), cost=Decimal("90.00"))

        names = [m.name for m in reports.mechanic_workload(TODAY)]

        self.assertEqual(names, ["Pricey", "Cheap"])


class MechanicWorkloadEndpointTests(AuthenticatedAPITestCase):
    def test_returns_year_and_rows(self):
        mechanic = make_mechanic(name="Ana")
        make_record(mechanic=mechanic, date=timezone.localdate(), cost=Decimal("75.50"))

        with self.assertNumQueries(1):
            response = self.client.get("/api/mechanics/workload/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["year"], timezone.localdate().year)
        row = response.json()["results"][0]
        self.assertEqual(row["name"], "Ana")
        self.assertEqual(row["maintenance_count"], 1)
        self.assertEqual(row["total_maintenance_cost"], 75.5)


class VehiclesNeedingMaintenanceTests(TestCase):
    def test_selects_overdue_and_never_serviced_active_vehicles_oldest_first(self):
        never = make_vehicle()
        overdue_long = make_vehicle()
        make_record(vehicle=overdue_long, date=TODAY - timedelta(days=900))
        overdue = make_vehicle()
        make_record(vehicle=overdue, date=TODAY - timedelta(days=366))
        boundary = make_vehicle()
        make_record(vehicle=boundary, date=TODAY - timedelta(days=365))
        recent = make_vehicle()
        make_record(vehicle=recent, date=TODAY - timedelta(days=900))
        make_record(vehicle=recent, date=TODAY - timedelta(days=10))
        make_vehicle(is_active=False)

        result = list(reports.vehicles_needing_maintenance(TODAY))

        self.assertEqual(result, [never, overdue_long, overdue])
        self.assertIsNone(result[0].last_maintenance)
        self.assertEqual(result[2].last_maintenance, TODAY - timedelta(days=366))


class VehiclesNeedingMaintenanceEndpointTests(AuthenticatedAPITestCase):
    url = "/api/vehicles/needs-maintenance/"

    def test_returns_paginated_rows_with_days_since_service(self):
        vehicle = make_vehicle()
        make_record(vehicle=vehicle, date=timezone.localdate() - timedelta(days=400))
        make_vehicle()

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 2)
        never, overdue = response.data["results"]
        self.assertIsNone(never["last_maintenance"])
        self.assertIsNone(never["days_since_last_maintenance"])
        self.assertEqual(overdue["days_since_last_maintenance"], 400)

    def test_accepts_vehicle_filters(self):
        office = make_office()
        in_office = make_vehicle(office=office)
        make_vehicle()

        response = self.client.get(self.url, {"office": office.pk})

        self.assertEqual([row["id"] for row in response.data["results"]], [in_office.pk])
