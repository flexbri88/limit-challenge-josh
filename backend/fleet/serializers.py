import re
from datetime import timedelta
from decimal import Decimal

from django.db.models import Q
from django.utils import timezone
from rest_framework import serializers

from .models import MaintenanceRecord, Mechanic, Office, Vehicle
from .validators import license_plate_validator

EARLIEST_VEHICLE_YEAR = 1980
# The server's "today" (UTC) can lag a user's local date by up to a day, so a
# record dated "today" by someone ahead of UTC must not count as future.
FUTURE_DATE_TOLERANCE = timedelta(days=1)


def normalize_identifier(value):
    """Upper-case and collapse whitespace so 'abc  123' and 'ABC 123' compare equal."""
    return re.sub(r"\s+", " ", value).strip().upper()


class NormalizedIdentifiersMixin:
    """Normalize identifier fields before validation, so uniqueness checks see stored values."""

    identifier_fields = ()

    def to_internal_value(self, data):
        if hasattr(data, "get"):
            updates = {
                field: normalize_identifier(data[field])
                for field in self.identifier_fields
                if isinstance(data.get(field), str)
            }
            if updates:
                # copy() keeps the type: a QueryDict (form/multipart input)
                # must stay a QueryDict, and item assignment replaces values.
                data = data.copy()
                for field, value in updates.items():
                    data[field] = value
        return super().to_internal_value(data)


class OfficeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Office
        fields = ["id", "name", "city"]

    def validate_name(self, value):
        return value.strip()

    def validate_city(self, value):
        return value.strip()


class MechanicSerializer(NormalizedIdentifiersMixin, serializers.ModelSerializer):
    identifier_fields = ("certification_number",)

    class Meta:
        model = Mechanic
        fields = ["id", "name", "certification_number", "is_active"]

    def validate_name(self, value):
        return value.strip()


class VehicleSerializer(NormalizedIdentifiersMixin, serializers.ModelSerializer):
    identifier_fields = ("vin", "license_plate")

    office_name = serializers.CharField(source="office.name", read_only=True)

    class Meta:
        model = Vehicle
        fields = [
            "id",
            "vin",
            "license_plate",
            "make",
            "model",
            "year",
            "office",
            "office_name",
            "is_active",
        ]
        extra_kwargs = {
            # DRF derives a UniqueValidator from the partial constraint that ignores
            # whether the submitted vehicle is itself active; validate() owns that rule.
            "license_plate": {"validators": [license_plate_validator]},
        }

    def validate_make(self, value):
        return value.strip()

    def validate_model(self, value):
        return value.strip()

    def validate_year(self, value):
        latest = timezone.localdate().year + 1
        if not EARLIEST_VEHICLE_YEAR <= value <= latest:
            raise serializers.ValidationError(
                f"Year must be between {EARLIEST_VEHICLE_YEAR} and {latest}."
            )
        return value

    def validate(self, attrs):
        # Enforce the partial unique constraint here to return a field-level 400
        # instead of letting the database raise an IntegrityError.
        plate = attrs.get("license_plate", getattr(self.instance, "license_plate", None))
        is_active = attrs.get("is_active", getattr(self.instance, "is_active", True))
        if is_active and plate:
            conflicts = Vehicle.objects.filter(license_plate=plate, is_active=True)
            if self.instance is not None:
                conflicts = conflicts.exclude(pk=self.instance.pk)
            if conflicts.exists():
                raise serializers.ValidationError(
                    {"license_plate": "An active vehicle with this license plate already exists."}
                )
        return attrs


class MaintenanceRecordSerializer(serializers.ModelSerializer):
    vehicle_license_plate = serializers.CharField(
        source="vehicle.license_plate", read_only=True
    )
    mechanic_name = serializers.CharField(source="mechanic.name", read_only=True)

    class Meta:
        model = MaintenanceRecord
        fields = [
            "id",
            "vehicle",
            "vehicle_license_plate",
            "mechanic",
            "mechanic_name",
            "date",
            "maintenance_type",
            "cost",
            "notes",
        ]

    def validate_date(self, value):
        if value > timezone.localdate() + FUTURE_DATE_TOLERANCE:
            raise serializers.ValidationError("Maintenance date cannot be in the future.")
        return value

    def validate_mechanic(self, value):
        # Historical records keep mechanics who have since left, but new work
        # can only be assigned to active mechanics.
        is_reassignment = self.instance is None or self.instance.mechanic_id != value.pk
        if is_reassignment and not value.is_active:
            raise serializers.ValidationError(
                "Maintenance cannot be assigned to an inactive mechanic."
            )
        return value


class MaintenanceHistorySerializer(serializers.ModelSerializer):
    """Read-only record representation nested under a vehicle."""

    mechanic = MechanicSerializer(read_only=True)
    maintenance_type_display = serializers.CharField(
        source="get_maintenance_type_display", read_only=True
    )

    class Meta:
        model = MaintenanceRecord
        fields = [
            "id",
            "date",
            "maintenance_type",
            "maintenance_type_display",
            "cost",
            "notes",
            "mechanic",
        ]
        read_only_fields = fields


class VehicleDetailSerializer(VehicleSerializer):
    """Vehicle with office and full maintenance history.

    Expects `maintenance_records` to be prefetched with their mechanics; the
    summary fields are computed from that prefetched list, not extra queries.
    """

    office_detail = OfficeSerializer(source="office", read_only=True)
    maintenance_records = MaintenanceHistorySerializer(many=True, read_only=True)
    maintenance_count = serializers.SerializerMethodField()
    total_maintenance_cost = serializers.SerializerMethodField()
    last_maintenance = serializers.SerializerMethodField()

    class Meta(VehicleSerializer.Meta):
        fields = VehicleSerializer.Meta.fields + [
            "office_detail",
            "maintenance_count",
            "total_maintenance_cost",
            "last_maintenance",
            "maintenance_records",
        ]

    def get_maintenance_count(self, vehicle):
        return len(vehicle.maintenance_records.all())

    def get_total_maintenance_cost(self, vehicle):
        return sum(
            (record.cost for record in vehicle.maintenance_records.all()), Decimal(0)
        )

    def get_last_maintenance(self, vehicle):
        records = vehicle.maintenance_records.all()
        return records[0].date if records else None


class OfficeAssignmentSerializer(serializers.Serializer):
    office = serializers.PrimaryKeyRelatedField(queryset=Office.objects.all())

    def validate_office(self, office):
        vehicle = self.context["vehicle"]
        if office.pk == vehicle.office_id:
            raise serializers.ValidationError("Vehicle is already assigned to this office.")
        return office

    def save(self):
        vehicle = self.context["vehicle"]
        vehicle.office = self.validated_data["office"]
        # Write only the assignment so concurrent edits to other fields are not overwritten.
        vehicle.save(update_fields=["office"])
        return vehicle


class OfficeSummarySerializer(serializers.ModelSerializer):
    active_vehicle_count = serializers.IntegerField(read_only=True)
    maintenance_cost_last_year = serializers.DecimalField(
        max_digits=12, decimal_places=2, read_only=True
    )
    last_maintenance = serializers.DateField(read_only=True, allow_null=True)

    class Meta:
        model = Office
        fields = [
            "id",
            "name",
            "city",
            "active_vehicle_count",
            "maintenance_cost_last_year",
            "last_maintenance",
        ]


class MechanicWorkloadSerializer(serializers.ModelSerializer):
    maintenance_count = serializers.IntegerField(read_only=True)
    total_maintenance_cost = serializers.DecimalField(
        max_digits=12, decimal_places=2, read_only=True
    )

    class Meta:
        model = Mechanic
        fields = [
            "id",
            "name",
            "certification_number",
            "is_active",
            "maintenance_count",
            "total_maintenance_cost",
        ]


class VehicleMaintenanceDueSerializer(VehicleSerializer):
    """Vehicle row annotated with `last_maintenance` by the needs-maintenance report."""

    last_maintenance = serializers.DateField(read_only=True, allow_null=True)
    days_since_last_maintenance = serializers.SerializerMethodField()

    class Meta(VehicleSerializer.Meta):
        fields = VehicleSerializer.Meta.fields + [
            "last_maintenance",
            "days_since_last_maintenance",
        ]

    def get_days_since_last_maintenance(self, vehicle):
        if vehicle.last_maintenance is None:
            return None
        return (self.context["today"] - vehicle.last_maintenance).days


class DuplicateCheckSerializer(serializers.Serializer):
    """Query parameters of the duplicate vehicle check."""

    vin = serializers.CharField(required=False, allow_blank=True)
    license_plate = serializers.CharField(required=False, allow_blank=True)
    exclude = serializers.IntegerField(
        required=False, help_text="Vehicle being edited, ignored in the check."
    )
    is_active = serializers.BooleanField(
        required=False,
        default=True,
        help_text="Whether the candidate vehicle would be active.",
    )

    def validate_vin(self, value):
        return normalize_identifier(value)

    def validate_license_plate(self, value):
        return normalize_identifier(value)

    def validate(self, attrs):
        if not attrs.get("vin") and not attrs.get("license_plate"):
            raise serializers.ValidationError("Provide vin, license_plate or both.")
        return attrs

    def find_conflicts(self):
        """Return the fields that collide with another vehicle, in one query."""
        vin = self.validated_data.get("vin")
        plate = self.validated_data.get("license_plate")
        # A plate only conflicts when both vehicles would be active.
        check_plate = bool(plate) and self.validated_data["is_active"]

        conditions = Q(pk__in=[])
        if vin:
            conditions |= Q(vin=vin)
        if check_plate:
            conditions |= Q(license_plate=plate, is_active=True)
        others = Vehicle.objects.filter(conditions)
        if "exclude" in self.validated_data:
            others = others.exclude(pk=self.validated_data["exclude"])

        conflicts = set()
        for other_vin, other_plate, other_active in others.values_list(
            "vin", "license_plate", "is_active"
        ):
            if vin and other_vin == vin:
                conflicts.add("vin")
            if check_plate and other_active and other_plate == plate:
                conflicts.add("license_plate")
        return [field for field in ("vin", "license_plate") if field in conflicts]
