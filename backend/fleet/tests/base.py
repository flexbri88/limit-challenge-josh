from django.contrib.auth import get_user_model
from rest_framework.test import APIClient, APITestCase


class SignedInClient(APIClient):
    """Sends every request as a signed-in user.

    Authentication itself is covered in test_auth; the other API tests are about
    the endpoints, so they skip the token round trip.
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Unsaved: it only has to pass IsAuthenticated, and never touches the database.
        self.force_authenticate(get_user_model()(username="api-tester"))


class AuthenticatedAPITestCase(APITestCase):
    client_class = SignedInClient
