from django.db.models import Prefetch
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from . import reports
from .filters import MechanicFilter, VehicleFilter
from .models import MaintenanceRecord, Mechanic, Office, Vehicle
from .serializers import (
    DuplicateCheckSerializer,
    MaintenanceHistorySerializer,
    MaintenanceRecordSerializer,
    MechanicSerializer,
    MechanicWorkloadSerializer,
    OfficeAssignmentSerializer,
    OfficeSerializer,
    OfficeSummarySerializer,
    VehicleDetailSerializer,
    VehicleMaintenanceDueSerializer,
    VehicleSerializer,
)


class OfficeViewSet(viewsets.ModelViewSet):
    queryset = Office.objects.all()
    serializer_class = OfficeSerializer
    filterset_fields = ["city"]
    ordering_fields = ["name", "city"]

    @action(detail=False, methods=["get"])
    def summary(self, request):
        """Unpaginated: one row per office, meant for dashboards."""
        offices = reports.office_summary(today=timezone.localdate())
        return Response(OfficeSummarySerializer(offices, many=True).data)


class MechanicViewSet(viewsets.ModelViewSet):
    queryset = Mechanic.objects.all()
    serializer_class = MechanicSerializer
    filterset_class = MechanicFilter
    ordering_fields = ["name", "certification_number"]

    @action(detail=False, methods=["get"])
    def workload(self, request):
        """Unpaginated: current-year workload per mechanic, busiest first."""
        today = timezone.localdate()
        mechanics = reports.mechanic_workload(today=today)
        return Response(
            {
                "year": today.year,
                "results": MechanicWorkloadSerializer(mechanics, many=True).data,
            }
        )


class VehicleViewSet(viewsets.ModelViewSet):
    queryset = Vehicle.objects.select_related("office")
    serializer_class = VehicleSerializer
    filterset_class = VehicleFilter
    ordering_fields = ["id", "make", "model", "year", "license_plate"]

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.action == "retrieve":
            # One query for the vehicle + office, one for all records + mechanics,
            # regardless of how long the history is.
            history = MaintenanceRecord.objects.select_related("mechanic").order_by(
                "-date", "-id"
            )
            queryset = queryset.prefetch_related(
                Prefetch("maintenance_records", queryset=history)
            )
        return queryset

    def get_serializer_class(self):
        if self.action == "retrieve":
            return VehicleDetailSerializer
        return super().get_serializer_class()

    @action(detail=False, methods=["get"], url_path="check-duplicate")
    def check_duplicate(self, request):
        """?vin=&license_plate=[&exclude=<id>][&is_active=] -> {"conflicts": [...]}"""
        serializer = DuplicateCheckSerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        return Response({"conflicts": serializer.find_conflicts()})

    @action(detail=False, methods=["get"], url_path="needs-maintenance")
    def needs_maintenance(self, request):
        """Active vehicles never serviced or not serviced in over a year.

        Accepts the same filters as the vehicle list (e.g. ?office=3).
        """
        today = timezone.localdate()
        vehicles = reports.vehicles_needing_maintenance(
            today=today, queryset=self.filter_queryset(self.get_queryset())
        )
        page = self.paginate_queryset(vehicles)
        serializer = VehicleMaintenanceDueSerializer(
            page, many=True, context={"today": today}
        )
        return self.get_paginated_response(serializer.data)

    @action(detail=True, methods=["get"], url_path="maintenance-history")
    def maintenance_history(self, request, pk=None):
        """Paginated maintenance history for one vehicle, newest first."""
        vehicle = self.get_object()
        records = vehicle.maintenance_records.select_related("mechanic").order_by(
            "-date", "-id"
        )
        page = self.paginate_queryset(records)
        serializer = MaintenanceHistorySerializer(page, many=True)
        return self.get_paginated_response(serializer.data)

    @action(detail=True, methods=["post"])
    def assign(self, request, pk=None):
        """Move the vehicle to another office: {"office": <id>}."""
        vehicle = self.get_object()
        serializer = OfficeAssignmentSerializer(
            data=request.data, context={"vehicle": vehicle}
        )
        serializer.is_valid(raise_exception=True)
        vehicle = serializer.save()
        return Response(VehicleSerializer(vehicle).data)


class MaintenanceRecordViewSet(viewsets.ModelViewSet):
    queryset = MaintenanceRecord.objects.select_related("vehicle", "mechanic")
    serializer_class = MaintenanceRecordSerializer
    filterset_fields = ["vehicle", "mechanic", "maintenance_type"]
    ordering_fields = ["date", "cost"]


class CurrentUserView(APIView):
    """The signed-in user, so the frontend can show who is logged in."""

    def get(self, request):
        user = request.user
        return Response(
            {
                "id": user.pk,
                "username": user.get_username(),
                "full_name": user.get_full_name() or user.get_username(),
            }
        )
