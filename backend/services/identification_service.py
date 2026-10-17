import base64
import logging
import math
import os

import requests

from services import openai_client

log = logging.getLogger(__name__)

PLANTNET_URL = "https://my-api.plantnet.org/v2/identify/all"
MAX_IMAGES = 5
CONFIDENT = 0.80
CLOSE_CALL = 0.15

ADJUDICATE_PROMPT = """These photos show one plant, taken near US ZIP code {location}.
A plant identification service narrowed it down to these species (with its confidence scores):
{choices}

Using the photos and what grows near that ZIP code, which one is it? Choose only from this list.
Give confidence as a float between 0.0 and 1.0; use 0.90 or higher only if the photos clearly show
the features that tell these species apart.

Respond only in JSON:
{{"scientific_name": "...", "confidence": 0.00}}"""

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
        return round(min(1.0, max(0.0, number)), 2) if math.isfinite(number) else 0.0
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


def _needs_confirmation(ranked):
    if not ranked or not ranked[0].get("scientific_name"):
        return True
    top = ranked[0]["confidence"]
    runner_up = ranked[1]["confidence"] if len(ranked) > 1 else 0.0
    # Rounded so float error can't push an exact 0.15 gap over the line.
    return top < CONFIDENT or round(top - runner_up, 2) <= CLOSE_CALL


def _result(top, candidates, source, needs_confirmation):
    return {
        "scientific_name": top["scientific_name"],
        "common_name": top["common_name"],
        "confidence": top["confidence"],
        "candidates": candidates,
        "source": source,
        "needs_confirmation": needs_confirmation,
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
    picked = str(reply.get("scientific_name") or "").strip().lower()
    for i, candidate in enumerate(ranked):
        if candidate["scientific_name"].lower() == picked:
            return i, _confidence(reply.get("confidence"))
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


def identify_species(images, location):
    if isinstance(images, str):
        images = [images]
    if not 1 <= len(images) <= MAX_IMAGES:
        raise ValueError(f"expected 1 to {MAX_IMAGES} images, got {len(images)}")
    if any(not isinstance(image, str) or image.startswith(("http:", "https:", "file:")) for image in images):
        raise ValueError("Upload JPEG or PNG photo data; remote URLs are not accepted")

    try:
        ranked = identify_with_plantnet(images)
    except Exception as err:
        # Never log str(err): the request URL carries the API key.
        log.warning("PlantNet failed (%s); falling back to OpenAI vision", _describe(err))
        ranked = []

    if ranked:
        if not _needs_confirmation(ranked):
            return _result(ranked[0], ranked[1:], "plantnet", False)
        try:
            pick = _adjudicate(images, ranked, location)
        except Exception as err:
            log.warning("OpenAI adjudication failed (%s); keeping PlantNet's top match", _describe(err))
            pick = None
        if pick is None:
            return _result(ranked[0], ranked[1:], "plantnet", True)
        i, confidence = pick
        return _result(dict(ranked[i], confidence=confidence), ranked[:i] + ranked[i + 1:], "openai_adjudicated", True)

    try:
        ranked = _identify_with_openai(images, location)
    except Exception as err:
        log.warning("OpenAI vision failed (%s)", _describe(err))
        return _result({"scientific_name": "", "common_name": "", "confidence": 0.0}, [], "none", True)
    return _result(ranked[0], ranked[1:], "openai_fallback", _needs_confirmation(ranked))


def _image_bytes(image):
    if image.startswith(("http:", "https:", "file:")):
        raise ValueError("Remote image URLs are not accepted")
    if image.startswith("data:"):
        image = image.split(",", 1)[1]
    if len(image) > 4 * 1024 * 1024 * 4 // 3 + 4:
        raise ValueError("Image exceeds the 4 MB limit")
    return base64.b64decode(image, validate=True)


def _mime(data):
    if data.startswith(b"\x89PNG"):
        return "image/png"
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    raise ValueError("PlantNet only accepts JPEG or PNG images")


def identify_with_plantnet(images):
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
    response.raise_for_status()
    body = response.json()
    if not isinstance(body, dict) or not isinstance(body.get("results"), list):
        raise ValueError("Identification response has no result list")
    ranked = []
    seen = set()
    for result in body["results"][:20]:
        if not isinstance(result, dict) or not isinstance(result.get("species"), dict):
            continue
        species = result["species"]
        name = _name(species.get("scientificNameWithoutAuthor"))
        if not name or name.lower() in seen:
            continue
        seen.add(name.lower())
        common = species.get("commonNames")
        ranked.append({
            "scientific_name": name,
            "common_name": _name(common[0]) if isinstance(common, list) and common else "",
            "confidence": _confidence(result.get("score")),
        })
    return sorted(ranked, key=lambda entry: entry["confidence"], reverse=True)[:5]
