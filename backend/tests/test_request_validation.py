"""Reject malformed survey inputs and prepare bounded photos without metadata."""
import base64
import io

import pytest
from PIL import Image, PngImagePlugin

from services import request_validation as validation


def image_bytes(format="PNG", size=(4, 3), **save_options):
    output = io.BytesIO()
    Image.new("RGB", size, "green").save(output, format=format, **save_options)
    return output.getvalue()


def encoded_photo(data, prefix=""):
    return prefix + base64.b64encode(data).decode("ascii")


@pytest.mark.parametrize("value", [None, 33431, "3343", "334311", "abcd1", "334٣١", "10001", "33500"])
def test_location_rejects_bad_types_non_ascii_and_unsupported_regions(value):
    with pytest.raises(ValueError):
        validation.location_field(value)


@pytest.mark.parametrize("value", ["32301", "32801", "33431", "33901", "34102", "34990"])
def test_location_accepts_known_florida_zips_across_the_state(value):
    assert validation.location_field(value) == value


def test_location_rejects_unmapped_zip_even_inside_florida_numeric_range():
    with pytest.raises(ValueError, match="county lookup"):
        validation.location_field("32099")


def test_text_rejects_control_characters_and_oversized_values():
    for value in ("school\x00name", "x" * 181, ["school"], True):
        with pytest.raises(ValueError):
            validation.text_field(value, "School name")
    assert validation.text_field("  West courtyard  ", "Survey area") == "West courtyard"


@pytest.mark.parametrize("plants", [None, {}, ["Coontie"], [None], [{}] * 301])
def test_observation_container_and_count_are_bounded(plants):
    with pytest.raises(ValueError):
        validation.plant_list(plants)


@pytest.mark.parametrize("field,value", [
    ("scientific_name", 42), ("plant_name", {}), ("taxon_id", "a" * 181),
    ("needs_confirmation", "false"), ("user_confirmed", 1), ("status_verified", None),
    ("confidence", True), ("confidence", "0.9"), ("confidence", -0.1), ("confidence", 1.1),
    ("confidence", float("nan")), ("confidence", float("inf")),
    pytest.param("confidence", 10 ** 1000, id="huge_positive_confidence"),
    pytest.param("confidence", -(10 ** 1000), id="huge_negative_confidence"),
    ("invasive_status", None), ("invasive_status", []), ("invasive_status", {}),
    ("wildlife_support", []), ("wildlife_support", "excellent"),
])
def test_observation_fields_reject_bad_types_values_and_nonfinite_numbers(field, value):
    with pytest.raises(ValueError):
        validation.plant_list([{field: value}])


def test_documented_manual_observation_and_unknown_support_survive_validation():
    plants = [{"scientific_name": "Zamia integrifolia", "confidence": None,
               "user_confirmed": True, "needs_confirmation": False, "status_verified": True,
               "invasive_status": "native", "wildlife_support": "documented"},
              {"wildlife_support": "unknown", "invasive_status": "unknown"}]
    assert validation.plant_list(plants) == plants


@pytest.mark.parametrize("value", [None, "Coontie", [42], [""], ["x"] * 41])
def test_species_lists_have_valid_names_and_bounded_size(value):
    with pytest.raises(ValueError):
        validation.species_list(value)
    with pytest.raises(ValueError):
        validation.species_list([], required=True)


@pytest.mark.parametrize("value", [[], "dry", {"sun": []}, {"moisture": True}, {"space": "tiny"}, {"maintenance": None}])
def test_site_conditions_reject_unrecognized_types_or_options(value):
    with pytest.raises(ValueError):
        validation.site_fields(value)


def test_proposal_fields_are_bounded_and_do_not_forward_extra_data():
    assert validation.proposal_fields({"budget": "$75", "private_extra": "not needed"}) == {"budget": "$75"}
    for value in ([], {"quantity": 2}, {"maintenance": "x" * 501}):
        with pytest.raises(ValueError):
            validation.proposal_fields(value)


@pytest.mark.parametrize("images", [None, [], ["x"] * 6, "photo", [1], [None], [""], ["a==="]])
def test_photos_require_a_small_list_of_decodable_strings(images):
    with pytest.raises(ValueError):
        validation.validate_images(images)


@pytest.mark.parametrize("url", ["https://example.com/plant.jpg", "http://127.0.0.1/internal", "http://169.254.169.254/metadata", "file:///private/photo.jpg", "HTTPS://example.com/photo.png"])
def test_remote_and_local_urls_are_rejected(url):
    with pytest.raises(ValueError):
        validation.validate_images([url])


@pytest.mark.parametrize("payload", [
    "data:image/svg+xml;base64,PHN2Zz4=", "data:image/jpeg,unencoded",
    encoded_photo(b"This is not an image"), encoded_photo(image_bytes("GIF")),
    encoded_photo(image_bytes("PNG")[:24]),
])
def test_actual_decode_rejects_disguised_unsupported_and_damaged_files(payload):
    with pytest.raises(ValueError):
        validation.validate_images([payload])


@pytest.mark.parametrize("format,prefix", [("JPEG", ""), ("PNG", "data:image/png;base64,")])
def test_valid_jpeg_and_png_are_normalized_to_real_jpeg(format, prefix):
    result = validation.validate_images([encoded_photo(image_bytes(format), prefix)])
    assert len(result) == 1 and result[0].startswith("data:image/jpeg;base64,")
    with Image.open(io.BytesIO(base64.b64decode(result[0].split(",", 1)[1]))) as image:
        assert image.format == "JPEG" and image.mode == "RGB" and image.size == (4, 3)


def test_orientation_is_applied_and_private_exif_is_removed():
    exif = Image.Exif()
    exif[274] = 6
    exif[315] = "private-camera-owner"
    exif[270] = "private-location-description"
    data = image_bytes("JPEG", size=(4, 3), exif=exif)
    normalized = validation.validate_images([encoded_photo(data)])[0]
    clean = base64.b64decode(normalized.split(",", 1)[1])
    with Image.open(io.BytesIO(clean)) as image:
        assert image.size == (3, 4) and not image.getexif()
    assert b"private-camera-owner" not in clean and b"private-location-description" not in clean


def test_png_text_is_removed_and_large_photo_is_resized():
    metadata = PngImagePlugin.PngInfo()
    metadata.add_text("Location", "private-campus-coordinate")
    data = image_bytes("PNG", size=(2000, 1000), pnginfo=metadata)
    normalized = validation.validate_images([encoded_photo(data)])[0]
    clean = base64.b64decode(normalized.split(",", 1)[1])
    with Image.open(io.BytesIO(clean)) as image:
        assert image.size == (1600, 800) and "Location" not in image.info
    assert b"private-campus-coordinate" not in clean


def test_byte_and_pixel_limits_apply_before_submission(monkeypatch):
    with pytest.raises(ValueError):
        validation.validate_images([encoded_photo(b"x" * (validation.MAX_IMAGE_BYTES + 1))])
    monkeypatch.setattr(validation, "MAX_IMAGE_PIXELS", 8)
    with pytest.raises(ValueError, match="resolution"):
        validation.validate_images([encoded_photo(image_bytes(size=(3, 3)))])
