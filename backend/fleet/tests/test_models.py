from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import IntegrityError
from django.test import TestCase

from fleet.models import Vehicle

from .factories import make_mechanic, make_record, make_vehicle


class VehicleConstraintTests(TestCase):
    def test_vin_must_be_unique(self):
        make_vehicle(vin="1HGCM82633A000001")
        with self.assertRaises(IntegrityError):
            make_vehicle(vin="1HGCM82633A000001")

    def test_two_active_vehicles_cannot_share_a_plate(self):
        make_vehicle(license_plate="ABC123")
        with self.assertRaises(IntegrityError):
            make_vehicle(license_plate="ABC123")

    def test_inactive_vehicle_may_share_plate_with_active_one(self):
        make_vehicle(license_plate="ABC123", is_active=False)
        make_vehicle(license_plate="ABC123", is_active=False)
        make_vehicle(license_plate="ABC123")

        self.assertEqual(Vehicle.objects.filter(license_plate="ABC123").count(), 3)

    def test_full_clean_reports_readable_plate_conflict(self):
        existing = make_vehicle(license_plate="ABC123")
        duplicate = Vehicle(
            vin="1HGCM82633A999999",
            license_plate="ABC123",
            make="Ford",
            model="Transit",
            year=2021,
            office=existing.office,
        )
        with self.assertRaisesMessage(
            ValidationError, "An active vehicle with this license plate already exists."
        ):
            duplicate.full_clean()

    def test_vin_format_is_validated(self):
        vehicle = make_vehicle()
        for invalid in ["SHORT", "1HGCM82633A00000I", "1HGCM82633A00000O"]:
            vehicle.vin = invalid
            with self.subTest(vin=invalid), self.assertRaises(ValidationError):
                vehicle.full_clean()


class MechanicConstraintTests(TestCase):
    def test_certification_number_must_be_unique(self):
        make_mechanic(certification_number="CERT-1")
        with self.assertRaises(IntegrityError):
            make_mechanic(certification_number="CERT-1")


class MaintenanceRecordConstraintTests(TestCase):
    def test_cost_cannot_be_negative(self):
        with self.assertRaises(IntegrityError):
            make_record(cost=Decimal("-1.00"))
