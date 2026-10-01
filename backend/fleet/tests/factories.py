"""Minimal object builders for tests; every field has a sensible default."""

import itertools
from datetime import date
from decimal import Decimal

from fleet.models import MaintenanceRecord, Mechanic, Office, Vehicle

_sequence = itertools.count(1)


def _next():
    return next(_sequence)


def make_office(**overrides):
    n = _next()
    fields = {"name": f"Office {n}", "city": "Springfield"}
    return Office.objects.create(**(fields | overrides))


def make_vehicle(**overrides):
    n = _next()
    fields = {
        "vin": f"1HGCM82633A{n:06d}",
        "license_plate": f"PLT{n:04d}",
        "make": "Ford",
        "model": "Transit",
        "year": 2020,
        "is_active": True,
    }
    fields |= overrides
    if "office" not in fields:
        fields["office"] = make_office()
    return Vehicle.objects.create(**fields)


def make_mechanic(**overrides):
    n = _next()
    fields = {"name": f"Mechanic {n}", "certification_number": f"CERT-{n:05d}"}
    return Mechanic.objects.create(**(fields | overrides))


def make_record(**overrides):
    fields = {
        "date": date(2025, 1, 15),
        "maintenance_type": MaintenanceRecord.MaintenanceType.OIL_CHANGE,
        "cost": Decimal("100.00"),
    }
    fields |= overrides
    if "vehicle" not in fields:
        fields["vehicle"] = make_vehicle()
    if "mechanic" not in fields:
        fields["mechanic"] = make_mechanic()
    return MaintenanceRecord.objects.create(**fields)
