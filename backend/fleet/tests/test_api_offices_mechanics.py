from rest_framework import status

from fleet.models import Mechanic, Office

from .base import AuthenticatedAPITestCase
from .factories import make_mechanic, make_office


class OfficeApiTests(AuthenticatedAPITestCase):
    url = "/api/offices/"

    def test_list_is_paginated(self):
        for _ in range(12):
            make_office()

        response = self.client.get(self.url, {"page_size": 5})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 12)
        self.assertEqual(len(response.data["results"]), 5)

    def test_create(self):
        response = self.client.post(
            self.url, {"name": " Boston HQ ", "city": "Boston"}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["name"], "Boston HQ")
        self.assertTrue(Office.objects.filter(name="Boston HQ").exists())

    def test_create_requires_name_and_city(self):
        response = self.client.post(self.url, {}, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("name", response.data)
        self.assertIn("city", response.data)

    def test_partial_update(self):
        office = make_office(city="Austin")

        response = self.client.patch(
            f"{self.url}{office.pk}/", {"city": "Dallas"}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        office.refresh_from_db()
        self.assertEqual(office.city, "Dallas")

    def test_delete(self):
        office = make_office()

        response = self.client.delete(f"{self.url}{office.pk}/")

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Office.objects.filter(pk=office.pk).exists())

    def test_unknown_office_returns_404(self):
        response = self.client.get(f"{self.url}999999/")

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class MechanicApiTests(AuthenticatedAPITestCase):
    url = "/api/mechanics/"

    def test_create_normalizes_certification_number(self):
        response = self.client.post(
            self.url,
            {"name": "Ana Lopez", "certification_number": " ase-123 "},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["certification_number"], "ASE-123")
        self.assertTrue(response.data["is_active"])

    def test_duplicate_certification_number_is_rejected(self):
        make_mechanic(certification_number="ASE-123")

        response = self.client.post(
            self.url,
            {"name": "Someone Else", "certification_number": "ase-123"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            response.data["certification_number"],
            ["A mechanic with this certification number already exists."],
        )

    def test_filter_by_active_flag(self):
        make_mechanic(is_active=True)
        make_mechanic(is_active=False)

        response = self.client.get(self.url, {"is_active": "false"})

        self.assertEqual(response.data["count"], 1)
        self.assertFalse(response.data["results"][0]["is_active"])

    def test_deactivate(self):
        mechanic = make_mechanic()

        response = self.client.patch(
            f"{self.url}{mechanic.pk}/", {"is_active": False}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(Mechanic.objects.get(pk=mechanic.pk).is_active)
