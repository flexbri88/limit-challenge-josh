from collections import Counter

from django.db import IntegrityError
from django.db.models import ProtectedError
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler

UNIQUE_VIOLATION_SQLSTATE = "23505"


def api_exception_handler(exc, context):
    """Extend DRF's handler to turn database conflicts into 409 responses."""
    if isinstance(exc, ProtectedError):
        return Response(
            {"detail": _protected_message(exc)}, status=status.HTTP_409_CONFLICT
        )
    if isinstance(exc, IntegrityError) and _is_unique_violation(exc):
        # Serializers catch known duplicates first; this covers two concurrent
        # writes racing for the same VIN, plate or certification number.
        return Response(
            {"detail": "Another change just used the same value. Refresh and try again."},
            status=status.HTTP_409_CONFLICT,
        )
    # Anything else (including other integrity errors, which indicate a bug)
    # propagates as a logged 500.
    return exception_handler(exc, context)


def _is_unique_violation(exc):
    cause = exc.__cause__
    sqlstate = getattr(cause, "sqlstate", None) or getattr(cause, "pgcode", None)
    return sqlstate == UNIQUE_VIOLATION_SQLSTATE or "UNIQUE constraint failed" in str(exc)


def _protected_message(exc):
    counts = Counter(obj._meta for obj in exc.protected_objects)
    references = ", ".join(
        f"{count} {meta.verbose_name if count == 1 else meta.verbose_name_plural}"
        for meta, count in counts.items()
    )
    return f"Cannot delete this item because it is still referenced by {references}."
