from datetime import date

from rest_framework import status

from .base import AuthenticatedAPITestCase
from .factories import make_mechanic, make_office, make_record, make_vehicle


class VehicleSearchTests(AuthenticatedAPITestCase):
    url = "/api/vehicles/"

    @classmethod
    def setUpTestData(cls):
        cls.denver = make_office(name="Denver")
        cls.austin = make_office(name="Austin")
        cls.transit = make_vehicle(
            office=cls.denver, make="Ford", model="Transit", license_plate="DEN-001"
        )
        cls.f150 = make_vehicle(
            office=cls.denver, make="Ford", model="F-150", is_active=False
        )
        cls.camry = make_vehicle(office=cls.austin, make="Toyota", model="Camry")

    def ids(self, **params):
        response = self.client.get(self.url, params)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        return {row["id"] for row in response.data["results"]}

    def test_no_filters_returns_all_vehicles(self):
        self.assertEqual(self.ids(), {self.transit.pk, self.f150.pk, self.camry.pk})

    def test_filter_by_office(self):
        self.assertEqual(self.ids(office=self.austin.pk), {self.camry.pk})

    def test_filter_by_active_flag(self):
        self.assertEqual(self.ids(is_active="false"), {self.f150.pk})

    def test_make_and_model_are_case_insensitive(self):
        self.assertEqual(self.ids(make="ford", model="transit"), {self.transit.pk})

    def test_filters_combine(self):
        self.assertEqual(
            self.ids(office=self.denver.pk, make="Ford", is_active="true"),
            {self.transit.pk},
        )

    def test_free_text_search(self):
        self.assertEqual(self.ids(search="den-0"), {self.transit.pk})

    def test_unknown_office_is_a_validation_error(self):
        response = self.client.get(self.url, {"office": 999999})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("office", response.data)


class VehicleMaintenanceSearchTests(AuthenticatedAPITestCase):
    url = "/api/vehicles/"

    @classmethod
    def setUpTestData(cls):
        cls.alice = make_mechanic(certification_number="ASE-111")
        cls.bob = make_mechanic(certification_number="ASE-222")

        # Alice serviced it in January, Bob in June.
        cls.van = make_vehicle()
        make_record(vehicle=cls.van, mechanic=cls.alice, date=date(2025, 1, 10))
        make_record(vehicle=cls.van, mechanic=cls.bob, date=date(2025, 6, 10))
        make_record(vehicle=cls.van, mechanic=cls.bob, date=date(2025, 6, 20))

        cls.truck = make_vehicle()
        make_record(vehicle=cls.truck, mechanic=cls.alice, date=date(2025, 6, 15))

        cls.never_serviced = make_vehicle()

    def ids(self, **params):
        response = self.client.get(self.url, params)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        return [row["id"] for row in response.data["results"]]

    def test_maintained_between_dates(self):
        self.assertEqual(
            sorted(self.ids(maintained_from="2025-06-01", maintained_to="2025-06-30")),
            sorted([self.van.pk, self.truck.pk]),
        )

    def test_open_ended_date_range(self):
        self.assertEqual(self.ids(maintained_to="2025-02-01"), [self.van.pk])

    def test_mechanic_certification_is_case_insensitive(self):
        self.assertEqual(self.ids(mechanic_certification="ase-222"), [self.van.pk])

    def test_date_range_and_mechanic_must_match_the_same_record(self):
        # Alice serviced the van, but not in June.
        self.assertEqual(
            self.ids(
                mechanic_certification="ASE-111",
                maintained_from="2025-06-01",
                maintained_to="2025-06-30",
            ),
            [self.truck.pk],
        )

    def test_multiple_matching_records_do_not_duplicate_vehicles(self):
        self.assertEqual(self.ids(mechanic_certification="ASE-222"), [self.van.pk])

    def test_inverted_date_range_is_rejected(self):
        response = self.client.get(
            self.url, {"maintained_from": "2025-06-30", "maintained_to": "2025-06-01"}
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("maintained_to", response.data)

    def test_invalid_date_is_rejected(self):
        response = self.client.get(self.url, {"maintained_from": "yesterday"})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
