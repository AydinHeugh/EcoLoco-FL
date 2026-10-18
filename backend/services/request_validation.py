"""Bounded, explicit validation at the HTTP boundary."""
import base64
import binascii
import io
import math
import re
import warnings

from PIL import Image, ImageOps
from services.fl_plants_service import supported_location

MAX_IMAGE_BYTES = 4 * 1024 * 1024
MAX_IMAGE_PIXELS = 20_000_000
MAX_OBSERVATIONS = 300
SITE_OPTIONS = {
    "sun": {"full", "part", "shade", "unknown"},
    "moisture": {"dry", "average", "wet", "unknown"},
    "space": {"small", "medium", "large", "unknown"},
    "maintenance": {"low", "moderate", "unknown"},
}


def text_field(value, label, limit=180, required=False):
    if value is None and not required:
        return ""
    if not isinstance(value, str) or len(value) > limit:
        raise ValueError(f"{label} must be text of at most {limit} characters.")
    value = value.strip()
    if required and not value:
        raise ValueError(f"{label} is required.")
    if any(ord(char) < 32 and char not in "\n\t" for char in value):
        raise ValueError(f"{label} contains unsupported characters.")
    return value


def location_field(value):
    value = text_field(value, "ZIP code", 5, required=True)
    if not re.fullmatch(r"[0-9]{5}", value):
        raise ValueError("Enter a five-digit US ZIP code.")
    if not supported_location(value):
        raise ValueError("Choose a Florida ZIP code included in the app's county lookup. Planting suggestions cover South Florida only.")
    return value


def plant_list(value):
    if not isinstance(value, list) or len(value) > MAX_OBSERVATIONS:
        raise ValueError(f"plants must be a list of at most {MAX_OBSERVATIONS} observations.")
    for plant in value:
        if not isinstance(plant, dict):
            raise ValueError("Each observation must be an object.")
        for key in ("scientific_name", "plant_name", "name", "taxon_id", "source", "id_source", "id"):
            if key in plant:
                text_field(plant[key], key)
        for key in ("needs_confirmation", "user_confirmed", "status_verified"):
            if key in plant and not isinstance(plant[key], bool):
                raise ValueError(f"{key} must be true or false.")
        if "confidence" in plant and plant["confidence"] is not None:
            confidence = plant["confidence"]
            if isinstance(confidence, bool) or not isinstance(confidence, (int, float)) or not 0 <= confidence <= 1 or not math.isfinite(confidence):
                raise ValueError("confidence must be between 0 and 1, or null.")
        for key, allowed in (("invasive_status", {"native", "non-native", "invasive", "unknown"}), ("wildlife_support", {"high", "medium", "low", "unknown", "documented"})):
            if key in plant and (not isinstance(plant[key], str) or plant[key] not in allowed):
                raise ValueError(f"{key} has an unsupported value.")
    return value


def species_list(value, label="Selected species", required=False):
    if not isinstance(value, list) or len(value) > 40 or (required and not value):
        raise ValueError(f"{label} must contain {'1 to' if required else 'at most'} 40 species names.")
    return [text_field(item, "Species name", required=True) for item in value]


def site_fields(value):
    if value is None:
        return {key: "unknown" for key in SITE_OPTIONS}
    if not isinstance(value, dict):
        raise ValueError("Site conditions must be an object.")
    result = {}
    for key, choices in SITE_OPTIONS.items():
        selected = value.get(key, "unknown")
        if not isinstance(selected, str) or selected not in choices:
            raise ValueError(f"Choose a supported {key} condition.")
        result[key] = selected
    return result


def proposal_fields(value):
    if value is None:
        return {}
    if not isinstance(value, dict):
        raise ValueError("Proposal details must be an object.")
    allowed = ("location", "quantity", "budget", "maintenance", "student_name", "school_name", "principal_name")
    return {key: text_field(value[key], key, 500) for key in allowed if key in value}


def validate_images(images):
    """Verify photos and remove metadata before any external service receives them."""
    if not isinstance(images, list) or not 1 <= len(images) <= 5:
        raise ValueError("Choose one to five photos of the same plant.")
    normalized = []
    for image in images:
        if not isinstance(image, str) or not image or len(image) > (MAX_IMAGE_BYTES * 4 // 3) + 128:
            raise ValueError("Each photo must be a JPEG or PNG no larger than 4 MB.")
        if image.startswith(("http:", "https:", "file:")):
            raise ValueError("Upload photo data; remote image URLs are not accepted.")
        encoded = image
        if image.startswith("data:"):
            match = re.fullmatch(r"data:image/(jpeg|png);base64,(.+)", image, re.DOTALL)
            if not match:
                raise ValueError("Only base64 JPEG and PNG photo data is supported.")
            encoded = match.group(2)
        try:
            data = base64.b64decode(encoded, validate=True)
        except (ValueError, binascii.Error):
            raise ValueError("The photo could not be decoded. Select it again.") from None
        if not data or len(data) > MAX_IMAGE_BYTES:
            raise ValueError("Each photo must be no larger than 4 MB.")
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("error", Image.DecompressionBombWarning)
                with Image.open(io.BytesIO(data)) as probe:
                    if probe.format not in {"JPEG", "PNG"}:
                        raise ValueError("Only JPEG and PNG photos are supported.")
                    if probe.width * probe.height > MAX_IMAGE_PIXELS:
                        raise ValueError("Photo resolution is too large. Choose a smaller copy.")
                    probe.verify()
                with Image.open(io.BytesIO(data)) as source:
                    photo = ImageOps.exif_transpose(source).convert("RGB")
                    photo.thumbnail((1600, 1600))
                    output = io.BytesIO()
                    photo.save(output, format="JPEG", quality=85)
            normalized.append("data:image/jpeg;base64," + base64.b64encode(output.getvalue()).decode("ascii"))
        except (Image.DecompressionBombError, Image.DecompressionBombWarning):
            raise ValueError("Photo resolution is too large. Choose a smaller copy.") from None
        except (OSError, SyntaxError):
            raise ValueError("The photo is damaged or unsupported. Choose a JPEG or PNG.") from None
    return normalized
