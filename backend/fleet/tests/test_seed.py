from datetime import timedelta
from io import StringIO

from django.contrib.auth import authenticate, get_user_model
from django.core.management import CommandError, call_command
from django.db.models import Count, Max
from django.test import TestCase
from django.utils import timezone

from fleet.management.commands.seed import DEMO_PASSWORD, DEMO_USERNAME
from fleet.models import MaintenanceRecord, Office, Vehicle


class SeedCommandTests(TestCase):
    def seed(self, *extra):
        call_command(
            "seed", "--offices=3", "--mechanics=5", "--vehicles=40", "--records=200",
            *extra, stdout=StringIO(),
        )

    def test_creates_requested_data_with_edge_cases(self):
        self.seed()

        self.assertEqual(Office.objects.count(), 3)
        self.assertEqual(Vehicle.objects.count(), 40)

        vehicles = Vehicle.objects.filter(is_active=True).annotate(
            records=Count("maintenance_records"),
            last=Max("maintenance_records__date"),
        )
        cutoff = timezone.localdate() - timedelta(days=365)
        self.assertTrue(vehicles.filter(records=0).exists())
        self.assertTrue(vehicles.filter(last__lt=cutoff).exists())
        self.assertTrue(vehicles.filter(records__gte=500).exists())

    def test_refuses_to_seed_over_existing_data_without_clear(self):
        self.seed()
        with self.assertRaises(CommandError):
            self.seed()

    def test_clear_replaces_existing_data(self):
        self.seed()
        self.seed("--clear")

        self.assertEqual(Vehicle.objects.count(), 40)
        self.assertGreater(MaintenanceRecord.objects.count(), 200)

    def test_counts_must_be_positive(self):
        with self.assertRaises(CommandError):
            call_command("seed", "--offices=0", stdout=StringIO())

    def test_failed_reseed_keeps_existing_data(self):
        self.seed()

        with self.assertRaises(CommandError):
            call_command("seed", "--clear", "--vehicles=1", stdout=StringIO())

        self.assertEqual(Vehicle.objects.count(), 40)

    def test_creates_a_demo_login_and_resets_its_password(self):
        self.seed()
        user = get_user_model().objects.get(username=DEMO_USERNAME)
        user.set_password("changed")
        user.save()

        self.seed("--clear")

        self.assertTrue(authenticate(username=DEMO_USERNAME, password=DEMO_PASSWORD))
        self.assertEqual(get_user_model().objects.count(), 1)

    def test_demo_login_can_be_skipped(self):
        self.seed("--no-demo-user")

        self.assertFalse(get_user_model().objects.exists())
