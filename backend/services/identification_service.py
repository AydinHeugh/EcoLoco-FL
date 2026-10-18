import base64
import logging
import math
import os

import requests

from services import openai_client
from services.fl_plants_service import _normalize, get_status

log = logging.getLogger(__name__)

PLANTNET_URL = "https://my-api.plantnet.org/v2/identify/all"
MAX_IMAGES = 5
MAX_IMAGE_BYTES = 4 * 1024 * 1024
NO_MATCH_BELOW = 0.20
CONFIDENT = 0.80
CLOSE_CALL = 0.15

ADJUDICATE_PROMPT = """These photos show one plant, taken near US ZIP code {location}.
A plant identification service narrowed it down to these species (with its confidence scores):
{choices}

Using the photos and what grows near that ZIP code, which one is it? Choose only from this list.
Suggest the listed species whose visible distinguishing features best match the photos.
Do not invent a species or change the supplied scores. If the photos do not distinguish
the candidates, return an empty scientific_name.

Respond only in JSON:
{{"scientific_name": "..."}}"""

VISION_PROMPT = """Identify the plant in these photos (1 to 5 photos of the same plant), taken near US ZIP code {location}.

Give confidence as a float between 0.0 and 1.0. Be genuinely calibrated:
- 0.90-0.99 only if the plant is clearly visible, unambiguous, and you are highly certain
- 0.70-0.89 if the image is clear but it could plausibly be one of a few similar plants
- 0.50-0.69 if the image is partly obscured, low quality, or hard to tell from similar species
- 0.30-0.49 if you are mostly guessing from limited visual information
- below 0.30 if you cannot reliably identify the plant
Do NOT default to round numbers like 0.9; use two decimals (e.g. 0.83, 0.61, 0.47).

Also list up to 3 other species it could plausibly be, most likely first.

Respond only in JSON:
{{"scientific_name": "...", "common_name": "...", "confidence": 0.00,
  "candidates": [{{"scientific_name": "...", "common_name": "...", "confidence": 0.00}}]}}"""


def _image_url(image):
    if image.startswith(("http:", "https:", "file:")):
        raise ValueError("Remote image URLs are not accepted")
    if image.startswith("data:image"):
        return image
    return f"data:image/jpeg;base64,{image}"


def _confidence(value):
    if isinstance(value, bool):
        return 0.0
    try:
        number = float(value)
        return min(1.0, max(0.0, number)) if math.isfinite(number) else 0.0
    except (TypeError, ValueError):
        return 0.0


def _species(raw):
    return {
        "scientific_name": _name(raw.get("scientific_name")),
        "common_name": _name(raw.get("common_name")),
        "confidence": _confidence(raw.get("confidence")),
    }


def _name(value):
    return value.strip()[:180] if isinstance(value, str) else ""


def _image_parts(images):
    return [{"type": "image_url", "image_url": {"url": _image_url(image)}} for image in images]


def _merge_same_species(ranked, location):
    """Deduplicate only exact normalized or catalog-backed synonym identities.

    Candidate scores are not independent probabilities. Keep the highest supplied
    score for one taxon rather than adding repeated predictions into certainty.
    The Florida resolver preserves varieties, subspecies, hybrids and exclusions.
    """
    merged = {}
    for raw in ranked if isinstance(ranked, list) else []:
        if not isinstance(raw, dict):
            continue
        candidate = _species(raw)
        name = candidate["scientific_name"]
        if not name:
            continue
        status = get_status(name, location)
        canonical = _name(status.get("scientific_name")) or name
        key = _normalize(canonical)
        if not key:
            continue
        candidate["scientific_name"] = canonical
        previous = merged.get(key)
        if previous is None:
            merged[key] = candidate
        elif candidate["confidence"] > previous["confidence"]:
            candidate["common_name"] = candidate["common_name"] or previous["common_name"]
            merged[key] = candidate
        elif not previous["common_name"]:
            previous["common_name"] = candidate["common_name"]
    return sorted(merged.values(), key=lambda item: item["confidence"], reverse=True)


def _state(ranked):
    if not ranked or not ranked[0].get("scientific_name") or ranked[0]["confidence"] < NO_MATCH_BELOW:
        return "unidentified"
    top = ranked[0]["confidence"]
    runner_up = ranked[1]["confidence"] if len(ranked) > 1 else 0.0
    # Tolerate binary float error only at the exact close-call boundary.
    if top < CONFIDENT or top - runner_up <= CLOSE_CALL + 1e-12:
        return "confirm"
    return "identified"


def _needs_confirmation(ranked):
    return _state(ranked) != "identified"


def _result(ranked, source, suggested=0, ai_unavailable=False):
    state = _state(ranked)
    if state == "unidentified":
        ranked, suggested = [], 0
    top = ranked[0] if ranked else {"scientific_name": "", "common_name": "", "confidence": 0.0}
    return {
        "scientific_name": top["scientific_name"],
        "common_name": top["common_name"],
        "confidence": top["confidence"],
        "candidates": ranked[1:],
        "source": source,
        "needs_confirmation": state != "identified",
        "state": state,
        # Index into [the flat top result, *candidates]; it never changes scores.
        "suggested": suggested,
        "ai_unavailable": ai_unavailable,
    }


def _describe(err):
    status = getattr(getattr(err, "response", None), "status_code", None)
    return f"{type(err).__name__} {status}" if status else type(err).__name__


def _adjudicate(images, ranked, location):
    choices = "\n".join(
        f"{i}. {c['scientific_name']} ({c['common_name'] or 'no common name'}): {c['confidence']:.2f}"
        for i, c in enumerate(ranked, 1)
    )
    reply = openai_client.chat([
        *_image_parts(images),
        {"type": "text", "text": ADJUDICATE_PROMPT.format(location=location, choices=choices)},
    ], json_reply=True)
    if not isinstance(reply, dict):
        return None
    picked = _normalize(_name(reply.get("scientific_name")))
    for i, candidate in enumerate(ranked):
        if _normalize(candidate["scientific_name"]) == picked:
            return i
    return None


def _identify_with_openai(images, location):
    raw = openai_client.chat([
        *_image_parts(images),
        {"type": "text", "text": VISION_PROMPT.format(location=location)},
    ], json_reply=True)
    if not isinstance(raw, dict):
        raise ValueError("Identification response must be an object")
    alternatives = raw.get("candidates")
    candidates = [_species(c) for c in alternatives[:3] if isinstance(c, dict)] if isinstance(alternatives, list) else []
    return [_species(raw), *candidates]


def _validate_images(images):
    if isinstance(images, str):
        images = [images]
    if not isinstance(images, (list, tuple)) or not 1 <= len(images) <= MAX_IMAGES:
        raise ValueError(f"expected 1 to {MAX_IMAGES} uploaded images")
    for image in images:
        if (not isinstance(image, str) or not image
                or image.lower().startswith(("http:", "https:", "file:"))):
            raise ValueError("Upload JPEG or PNG photo data; remote URLs are not accepted")
        encoded = image.split(",", 1)[1] if image.startswith("data:") and "," in image else image
        if len(encoded) > MAX_IMAGE_BYTES * 4 // 3 + 4:
            raise ValueError("Image exceeds the 4 MB limit")
    return list(images)


def identify_species(images, location):
    images = _validate_images(images)
    try:
        ranked = _merge_same_species(identify_with_plantnet(images), location)
    except Exception as err:
        # Never log str(err): the request URL carries the API key.
        log.warning("PlantNet failed (%s); falling back to OpenAI vision", _describe(err))
    else:
        # A successful no-match is evidence to retake the photo, not a reason to
        # ask another provider for a more confident answer.
        if _state(ranked) != "confirm":
            return _result(ranked, "plantnet")
        try:
            pick = _adjudicate(images, ranked, location)
        except Exception as err:
            log.warning("OpenAI adjudication failed (%s); keeping PlantNet's order", _describe(err))
            return _result(ranked, "plantnet", ai_unavailable=True)
        if pick is None:
            return _result(ranked, "plantnet")
        return _result(ranked, "openai_adjudicated", suggested=pick)

    try:
        ranked = _merge_same_species(_identify_with_openai(images, location), location)
    except Exception as err:
        log.warning("OpenAI vision failed (%s)", _describe(err))
        return _result([], "none", ai_unavailable=True)
    return _result(ranked, "openai_fallback")


def _image_bytes(image):
    if image.startswith(("http:", "https:", "file:")):
        raise ValueError("Remote image URLs are not accepted")
    if image.startswith("data:"):
        image = image.split(",", 1)[1]
    if len(image) > MAX_IMAGE_BYTES * 4 // 3 + 4:
        raise ValueError("Image exceeds the 4 MB limit")
    data = base64.b64decode(image, validate=True)
    if len(data) > MAX_IMAGE_BYTES:
        raise ValueError("Image exceeds the 4 MB limit")
    return data


def _mime(data):
    if data.startswith(b"\x89PNG"):
        return "image/png"
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    raise ValueError("PlantNet only accepts JPEG or PNG images")


def identify_with_plantnet(images):
    images = _validate_images(images)
    key = os.getenv("PLANTNET_API_KEY")
    if not key:
        raise RuntimeError("PLANTNET_API_KEY is not set")
    files = []
    for i, image in enumerate(images):
        data = _image_bytes(image)
        files.append(("images", (f"photo{i + 1}", data, _mime(data))))
    response = requests.post(
        PLANTNET_URL,
        params={"api-key": key, "nb-results": 5, "lang": "en"},
        files=files,
        timeout=(3, 12),
    )
    if response.status_code == 404:
        return []
    response.raise_for_status()
    body = response.json()
    if not isinstance(body, dict) or not isinstance(body.get("results"), list):
        raise ValueError("Identification response has no result list")
    ranked = []
    for result in body["results"][:20]:
        if not isinstance(result, dict) or not isinstance(result.get("species"), dict):
            continue
        species = result["species"]
        name = _name(species.get("scientificNameWithoutAuthor"))
        if not name:
            continue
        common = species.get("commonNames")
        ranked.append({
            "scientific_name": name,
            "common_name": _name(common[0]) if isinstance(common, list) and common else "",
            "confidence": _confidence(result.get("score")),
        })
    return _merge_same_species(ranked, None)[:5]
