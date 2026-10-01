import django_filters
from django import forms
from django.db.models import Exists, OuterRef, Q

from .models import MaintenanceRecord, Mechanic, Office, Vehicle


class StrictBooleanFilter(django_filters.TypedChoiceFilter):
    """Accepts only `true`/`false`; anything else is a 400 rather than silently ignored."""

    def __init__(self, *args, **kwargs):
        kwargs.setdefault("choices", [("true", "true"), ("false", "false")])
        kwargs.setdefault("coerce", lambda value: value == "true")
        super().__init__(*args, **kwargs)


class VehicleFilterForm(forms.Form):
    def clean(self):
        cleaned = super().clean()
        start, end = cleaned.get("maintained_from"), cleaned.get("maintained_to")
        if start and end and start > end:
            self.add_error("maintained_to", "Must be on or after maintained_from.")
        return cleaned


class VehicleFilter(django_filters.FilterSet):
    office = django_filters.ModelChoiceFilter(queryset=Office.objects.all())
    is_active = StrictBooleanFilter()
    make = django_filters.CharFilter(lookup_expr="iexact")
    model = django_filters.CharFilter(lookup_expr="iexact")
    search = django_filters.CharFilter(
        method="filter_search", label="VIN, plate, make or model contains"
    )
    # The maintenance filters are applied together in filter_queryset() so that
    # they must all match the same maintenance record.
    maintained_from = django_filters.DateFilter(
        method="defer_to_maintenance_filter", label="Maintained on or after"
    )
    maintained_to = django_filters.DateFilter(
        method="defer_to_maintenance_filter", label="Maintained on or before"
    )
    mechanic_certification = django_filters.CharFilter(
        method="defer_to_maintenance_filter", label="Serviced by mechanic (cert. number)"
    )

    class Meta:
        model = Vehicle
        fields = ["office", "is_active", "make", "model"]
        form = VehicleFilterForm

    def filter_search(self, queryset, name, value):
        value = value.strip()
        if not value:
            return queryset
        return queryset.filter(
            Q(vin__icontains=value)
            | Q(license_plate__icontains=value)
            | Q(make__icontains=value)
            | Q(model__icontains=value)
        )

    def defer_to_maintenance_filter(self, queryset, name, value):
        return queryset

    def filter_queryset(self, queryset):
        queryset = super().filter_queryset(queryset)
        conditions = self._maintenance_conditions(self.form.cleaned_data)
        if not conditions:
            return queryset
        # EXISTS avoids the duplicate rows (and DISTINCT) a join would need.
        matching_records = MaintenanceRecord.objects.filter(
            vehicle=OuterRef("pk"), **conditions
        )
        return queryset.filter(Exists(matching_records))

    @staticmethod
    def _maintenance_conditions(data):
        conditions = {}
        if data.get("maintained_from"):
            conditions["date__gte"] = data["maintained_from"]
        if data.get("maintained_to"):
            conditions["date__lte"] = data["maintained_to"]
        if certification := (data.get("mechanic_certification") or "").strip():
            conditions["mechanic__certification_number__iexact"] = certification
        return conditions


class MechanicFilter(django_filters.FilterSet):
    is_active = StrictBooleanFilter()

    class Meta:
        model = Mechanic
        fields = ["is_active", "certification_number"]
