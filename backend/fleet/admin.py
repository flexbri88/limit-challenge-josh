from django.contrib import admin

from .models import MaintenanceRecord, Mechanic, Office, Vehicle


@admin.register(Office)
class OfficeAdmin(admin.ModelAdmin):
    list_display = ["name", "city"]
    search_fields = ["name", "city"]


@admin.register(Vehicle)
class VehicleAdmin(admin.ModelAdmin):
    list_display = ["vin", "license_plate", "make", "model", "year", "office", "is_active"]
    list_filter = ["is_active", "office", "make"]
    list_select_related = ["office"]
    search_fields = ["vin", "license_plate", "make", "model"]


@admin.register(Mechanic)
class MechanicAdmin(admin.ModelAdmin):
    list_display = ["name", "certification_number", "is_active"]
    list_filter = ["is_active"]
    search_fields = ["name", "certification_number"]


@admin.register(MaintenanceRecord)
class MaintenanceRecordAdmin(admin.ModelAdmin):
    list_display = ["date", "vehicle", "mechanic", "maintenance_type", "cost"]
    list_filter = ["maintenance_type", "date"]
    list_select_related = ["vehicle", "mechanic"]
    raw_id_fields = ["vehicle", "mechanic"]
    date_hierarchy = "date"
