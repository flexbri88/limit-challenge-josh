import random
import argparse
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone
from faker import Faker

from fleet.models import MaintenanceRecord, Mechanic, Office, Vehicle

VEHICLE_CATALOG = {
    "Ford": ["Transit", "F-150", "Explorer", "Escape"],
    "Toyota": ["Camry", "Corolla", "RAV4", "Tacoma", "Prius"],
    "Chevrolet": ["Silverado", "Malibu", "Express", "Equinox"],
    "Honda": ["Civic", "Accord", "CR-V", "Odyssey"],
    "Ram": ["1500", "ProMaster"],
    "Nissan": ["Altima", "Rogue", "NV200"],
    "Tesla": ["Model 3", "Model Y"],
}

# Typical cost range (USD) per maintenance type.
COST_RANGES = {
    MaintenanceRecord.MaintenanceType.OIL_CHANGE: (40, 120),
    MaintenanceRecord.MaintenanceType.TIRES: (300, 1200),
    MaintenanceRecord.MaintenanceType.BRAKES: (200, 900),
    MaintenanceRecord.MaintenanceType.INSPECTION: (50, 200),
    MaintenanceRecord.MaintenanceType.ENGINE: (800, 5000),
    MaintenanceRecord.MaintenanceType.BATTERY: (120, 350),
    MaintenanceRecord.MaintenanceType.REPAIR: (150, 2500),
    MaintenanceRecord.MaintenanceType.OTHER: (50, 600),
}

VIN_ALPHABET = "ABCDEFGHJKLMNPRSTUVWXYZ0123456789"
HISTORY_DAYS = 3 * 365

# Share of active vehicles deliberately left without recent maintenance, so the
# "vehicles needing maintenance" report always has something to show.
NEVER_SERVICED_SHARE = 0.05
OVERDUE_SHARE = 0.08
# One vehicle gets a long history to exercise the vehicle detail endpoint.
HEAVY_HISTORY_RECORDS = 500

# Login created for trying the app locally; never deploy with it.
DEMO_USERNAME = "demo"
DEMO_PASSWORD = "demo1234"


def positive_int(value):
    number = int(value)
    if number < 1:
        raise argparse.ArgumentTypeError("must be at least 1")
    return number


class Command(BaseCommand):
    help = "Fill the database with realistic fake fleet data for manual testing."

    def add_arguments(self, parser):
        parser.add_argument("--offices", type=positive_int, default=8)
        parser.add_argument("--mechanics", type=positive_int, default=25)
        parser.add_argument("--vehicles", type=positive_int, default=200)
        parser.add_argument("--records", type=positive_int, default=3000)
        parser.add_argument(
            "--seed", type=int, default=42, help="Random seed for reproducible data."
        )
        parser.add_argument(
            "--clear", action="store_true", help="Delete existing fleet data first."
        )
        parser.add_argument(
            "--no-demo-user",
            action="store_false",
            dest="demo_user",
            help=f"Skip creating the '{DEMO_USERNAME}' login.",
        )

    def handle(self, *args, **options):
        self.rng = random.Random(options["seed"])
        self.faker = Faker()
        self.faker.seed_instance(options["seed"])
        self.today = timezone.localdate()

        if not options["clear"] and Office.objects.exists():
            raise CommandError(
                "The database already contains fleet data. Re-run with --clear to replace it."
            )

        # One transaction: a failure never leaves the database cleared but empty.
        with transaction.atomic():
            if options["clear"]:
                self._clear()
            offices = self._create_offices(options["offices"])
            mechanics = self._create_mechanics(options["mechanics"])
            vehicles = self._create_vehicles(options["vehicles"], offices)
            records = self._create_records(options["records"], vehicles, mechanics)

        self.stdout.write(
            self.style.SUCCESS(
                f"Created {len(offices)} offices, {len(mechanics)} mechanics, "
                f"{len(vehicles)} vehicles and {records} maintenance records."
            )
        )
        if options["demo_user"]:
            self._ensure_demo_user()

    def _ensure_demo_user(self):
        """A known login for trying the app; its password is reset on every run."""
        user, _ = get_user_model().objects.get_or_create(username=DEMO_USERNAME)
        user.set_password(DEMO_PASSWORD)
        user.is_active = True
        user.save()
        self.stdout.write(f"Sign in as {DEMO_USERNAME} / {DEMO_PASSWORD}.")

    def _clear(self):
        # Delete in dependency order because offices and mechanics are PROTECTed.
        MaintenanceRecord.objects.all().delete()
        Vehicle.objects.all().delete()
        Mechanic.objects.all().delete()
        Office.objects.all().delete()
        self.stdout.write("Cleared existing fleet data.")

    def _create_offices(self, count):
        cities = self._unique(self.faker.city, count)
        return Office.objects.bulk_create(
            Office(name=f"{city} Office", city=city) for city in cities
        )

    def _create_mechanics(self, count):
        cert_numbers = self._unique(
            lambda: f"ASE-{self.rng.randint(100000, 999999)}", count
        )
        return Mechanic.objects.bulk_create(
            Mechanic(
                name=self.faker.name(),
                certification_number=cert,
                is_active=self.rng.random() > 0.1,
            )
            for cert in cert_numbers
        )

    def _create_vehicles(self, count, offices):
        vins = self._unique(self._random_vin, count)
        plates = self._unique(self._random_plate, count)
        vehicles = []
        for vin, plate in zip(vins, plates):
            make = self.rng.choice(list(VEHICLE_CATALOG))
            vehicles.append(
                Vehicle(
                    vin=vin,
                    license_plate=plate,
                    make=make,
                    model=self.rng.choice(VEHICLE_CATALOG[make]),
                    year=self.rng.randint(2012, self.today.year),
                    office=self.rng.choice(offices),
                    is_active=self.rng.random() > 0.1,
                )
            )
        self._reuse_plate_on_retired_vehicle(vehicles)
        return Vehicle.objects.bulk_create(vehicles)

    def _reuse_plate_on_retired_vehicle(self, vehicles):
        """Give one retired vehicle the plate of an active one (allowed by the rules)."""
        active = [v for v in vehicles if v.is_active]
        retired = [v for v in vehicles if not v.is_active]
        if active and retired:
            retired[0].license_plate = active[0].license_plate

    def _create_records(self, count, vehicles, mechanics):
        active = [v for v in vehicles if v.is_active]
        self.rng.shuffle(active)
        never_serviced_count = max(1, int(len(active) * NEVER_SERVICED_SHARE))
        overdue_count = max(1, int(len(active) * OVERDUE_SHARE))

        never_serviced = active[:never_serviced_count]
        overdue = active[never_serviced_count : never_serviced_count + overdue_count]
        excluded = {v.pk for v in never_serviced + overdue}
        regular = [v for v in vehicles if v.pk not in excluded]
        if not regular:
            raise CommandError("Use at least 5 vehicles to build a realistic history.")

        records = [
            # Overdue vehicles were last serviced 13 months to 3 years ago.
            self._build_record(
                vehicle, self.rng.choice(mechanics), self._date_within(HISTORY_DAYS, 400)
            )
            for vehicle in overdue
        ]
        records += [
            self._build_record(
                self.rng.choice(regular),
                self.rng.choice(mechanics),
                self._date_within(HISTORY_DAYS),
            )
            for _ in range(count)
        ]
        heavy = regular[0]
        records += [
            self._build_record(
                heavy, self.rng.choice(mechanics), self._date_within(HISTORY_DAYS)
            )
            for _ in range(HEAVY_HISTORY_RECORDS)
        ]
        MaintenanceRecord.objects.bulk_create(records, batch_size=1000)

        self.stdout.write(
            f"Edge cases: {len(never_serviced)} never-serviced and {len(overdue)} "
            f"overdue vehicles; vehicle #{heavy.pk} ({heavy.license_plate}) has "
            f"{HEAVY_HISTORY_RECORDS}+ records."
        )
        return len(records)

    def _build_record(self, vehicle, mechanic, when):
        maintenance_type = self.rng.choice(list(COST_RANGES))
        low, high = COST_RANGES[maintenance_type]
        return MaintenanceRecord(
            vehicle=vehicle,
            mechanic=mechanic,
            date=when,
            maintenance_type=maintenance_type,
            cost=Decimal(self.rng.randint(low * 100, high * 100)) / 100,
            notes=self.faker.sentence() if self.rng.random() > 0.4 else "",
        )

    def _date_within(self, max_days_ago, min_days_ago=0):
        return self.today - timedelta(days=self.rng.randint(min_days_ago, max_days_ago))

    def _random_vin(self):
        return "".join(self.rng.choices(VIN_ALPHABET, k=17))

    def _random_plate(self):
        letters = "".join(self.rng.choices("ABCDEFGHJKLMNPRSTUVWXYZ", k=3))
        return f"{letters}-{self.rng.randint(1000, 9999)}"

    @staticmethod
    def _unique(generator, count):
        values = set()
        while len(values) < count:
            values.add(generator())
        return sorted(values)
