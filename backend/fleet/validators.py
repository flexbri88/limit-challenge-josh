from django.core.validators import RegexValidator

# ISO 3779: 17 characters, letters I, O and Q are never used.
vin_validator = RegexValidator(
    regex=r"^[A-HJ-NPR-Z0-9]{17}$",
    message="VIN must be 17 characters using digits and letters other than I, O and Q.",
)

license_plate_validator = RegexValidator(
    regex=r"^[A-Z0-9][A-Z0-9 -]{0,13}[A-Z0-9]$",
    message="License plate must be 2-15 characters: letters, digits, spaces or hyphens.",
)
