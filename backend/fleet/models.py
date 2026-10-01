from django.core.validators import MinValueValidator
from django.db import models
from django.db.models import Q

from .validators import license_plate_validator, vin_validator


class Office(models.Model):
    name = models.CharField(max_length=100)
    city = models.CharField(max_length=100)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.city})"


class Vehicle(models.Model):
    vin = models.CharField(
        "VIN",
        max_length=17,
        unique=True,
        validators=[vin_validator],
        error_messages={"unique": "A vehicle with this VIN already exists."},
    )
    license_plate = models.CharField(max_length=15, validators=[license_plate_validator])
    make = models.CharField(max_length=50)
    model = models.CharField(max_length=50)
    year = models.PositiveSmallIntegerField()
    office = models.ForeignKey(
        Office, on_delete=models.PROTECT, related_name="vehicles"
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["id"]
        constraints = [
            # A plate may be reused once the vehicle holding it is retired.
            models.UniqueConstraint(
                fields=["license_plate"],
                condition=Q(is_active=True),
                name="unique_active_license_plate",
                violation_error_message=(
                    "An active vehicle with this license plate already exists."
                ),
            ),
        ]
        indexes = [
            models.Index(fields=["make", "model"], name="vehicle_make_model_idx"),
        ]

    def __str__(self):
        return f"{self.year} {self.make} {self.model} ({self.license_plate})"


class Mechanic(models.Model):
    name = models.CharField(max_length=100)
    certification_number = models.CharField(
        max_length=30,
        unique=True,
        error_messages={
            "unique": "A mechanic with this certification number already exists."
        },
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.certification_number})"


class MaintenanceRecord(models.Model):
    class MaintenanceType(models.TextChoices):
        OIL_CHANGE = "oil_change", "Oil change"
        TIRES = "tires", "Tires"
        BRAKES = "brakes", "Brakes"
        INSPECTION = "inspection", "Inspection"
        ENGINE = "engine", "Engine"
        BATTERY = "battery", "Battery"
        REPAIR = "repair", "General repair"
        OTHER = "other", "Other"

    vehicle = models.ForeignKey(
        Vehicle, on_delete=models.CASCADE, related_name="maintenance_records"
    )
    mechanic = models.ForeignKey(
        Mechanic, on_delete=models.PROTECT, related_name="maintenance_records"
    )
    date = models.DateField()
    maintenance_type = models.CharField(max_length=20, choices=MaintenanceType.choices)
    cost = models.DecimalField(
        max_digits=10, decimal_places=2, validators=[MinValueValidator(0)]
    )
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-date", "-id"]
        constraints = [
            models.CheckConstraint(
                condition=Q(cost__gte=0), name="maintenance_cost_non_negative"
            ),
        ]
        indexes = [
            # Per-vehicle history (newest first) and "last maintenance" lookups.
            models.Index(fields=["vehicle", "-date"], name="record_vehicle_date_idx"),
            # Per-mechanic workload for a date range.
            models.Index(fields=["mechanic", "date"], name="record_mechanic_date_idx"),
            # Fleet-wide date range filters and rolling cost windows.
            models.Index(fields=["date"], name="record_date_idx"),
        ]

    def __str__(self):
        return f"{self.get_maintenance_type_display()} on {self.date} for {self.vehicle}"
