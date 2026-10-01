"""Aggregate queries behind the reporting endpoints.

Each function takes `today` explicitly so results are deterministic in tests.
"""

from datetime import date, timedelta
from decimal import Decimal

from django.db.models import Count, DecimalField, F, Max, Q, Sum, Value
from django.db.models.functions import Coalesce

from .models import Mechanic, Office, Vehicle

ZERO_MONEY = Value(
    Decimal("0.00"), output_field=DecimalField(max_digits=12, decimal_places=2)
)


def one_year_before(day: date) -> date:
    try:
        return day.replace(year=day.year - 1)
    except ValueError:  # 29 February
        return day.replace(year=day.year - 1, day=28)


def office_summary(today: date):
    """Every office with active vehicle count, 12-month maintenance cost and last maintenance.

    Maintenance is attributed to the vehicle's current office. The joins follow a
    single chain (office -> vehicles -> records), so SUM is not inflated; the
    vehicle COUNT uses DISTINCT because each vehicle repeats once per record.
    """
    window_start = one_year_before(today)
    return Office.objects.annotate(
        active_vehicle_count=Count(
            "vehicles", filter=Q(vehicles__is_active=True), distinct=True
        ),
        maintenance_cost_last_year=Coalesce(
            Sum(
                "vehicles__maintenance_records__cost",
                filter=Q(
                    vehicles__maintenance_records__date__gte=window_start,
                    vehicles__maintenance_records__date__lte=today,
                ),
            ),
            ZERO_MONEY,
        ),
        last_maintenance=Max("vehicles__maintenance_records__date"),
    ).order_by("name")


def mechanic_workload(today: date):
    """Mechanics with record count and total cost for the current calendar year.

    Includes mechanics without work this year (zero values) so the list doubles
    as a capacity view; ordered busiest first, cost then name as tie-breakers.
    """
    this_year = Q(
        maintenance_records__date__gte=date(today.year, 1, 1),
        maintenance_records__date__lte=date(today.year, 12, 31),
    )
    return Mechanic.objects.annotate(
        maintenance_count=Count("maintenance_records", filter=this_year),
        total_maintenance_cost=Coalesce(
            Sum("maintenance_records__cost", filter=this_year), ZERO_MONEY
        ),
    ).order_by("-maintenance_count", "-total_maintenance_cost", "name")


MAINTENANCE_INTERVAL_DAYS = 365


def vehicles_needing_maintenance(today: date, queryset=None):
    """Active vehicles never serviced or last serviced more than 365 days ago.

    Ordered by oldest maintenance first; never-serviced vehicles lead the list
    as the most overdue.
    """
    queryset = Vehicle.objects.all() if queryset is None else queryset
    cutoff = today - timedelta(days=MAINTENANCE_INTERVAL_DAYS)
    return (
        queryset.filter(is_active=True)
        .annotate(last_maintenance=Max("maintenance_records__date"))
        .filter(Q(last_maintenance__isnull=True) | Q(last_maintenance__lt=cutoff))
        .order_by(F("last_maintenance").asc(nulls_first=True), "id")
    )
