from django.urls import path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import (
    TokenBlacklistView,
    TokenObtainPairView,
    TokenRefreshView,
)

from . import views

router = DefaultRouter()
router.register("offices", views.OfficeViewSet)
router.register("mechanics", views.MechanicViewSet)
router.register("vehicles", views.VehicleViewSet)
router.register("maintenance-records", views.MaintenanceRecordViewSet)

urlpatterns = [
    # The token views are public; everything else needs an access token.
    path("auth/token/", TokenObtainPairView.as_view(), name="token-obtain"),
    path("auth/token/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("auth/logout/", TokenBlacklistView.as_view(), name="token-logout"),
    path("auth/me/", views.CurrentUserView.as_view(), name="current-user"),
    *router.urls,
]
