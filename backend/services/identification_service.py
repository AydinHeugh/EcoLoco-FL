import base64
import logging
import os

import requests

from services import openai_client
from services.species_service import resolve

log = logging.getLogger(__name__)

PLANTNET_URL = "https://my-api.plantnet.org/v2/identify/all"
MAX_IMAGES = 5
NO_MATCH_BELOW = 0.20
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
    if image.startswith(("http://", "https://", "data:image")):
        return image
    return f"data:image/jpeg;base64,{image}"


def _confidence(value):
    try:
        return round(min(1.0, max(0.0, float(value))), 2)
    except (TypeError, ValueError):
        return 0.0


def _species(raw):
    return {
        "scientific_name": str(raw.get("scientific_name") or "").strip(),
        "common_name": str(raw.get("common_name") or "").strip(),
        "confidence": _confidence(raw.get("confidence")),
    }


def _image_parts(images):
    return [{"type": "image_url", "image_url": {"url": _image_url(image)}} for image in images]


def _state(ranked):
    if not ranked or not ranked[0]["scientific_name"] or ranked[0]["confidence"] < NO_MATCH_BELOW:
        return "unidentified"
    top = ranked[0]["confidence"]
    runner_up = ranked[1]["confidence"] if len(ranked) > 1 else 0.0
    # Rounded so float error can't push an exact 0.15 gap over the line.
    if top < CONFIDENT or round(top - runner_up, 2) <= CLOSE_CALL:
        return "confirm"
    return "identified"


def _result(state, ranked, source, suggested=0):
    if state == "unidentified":
        ranked = []
    return {"state": state, "ranked": ranked, "suggested": suggested, "source": source}


def _merge_same_species(ranked):
    merged = {}
    for candidate in ranked:
        name = resolve(candidate["scientific_name"]) or candidate["scientific_name"]
        if name in merged:
            entry = merged[name]
            entry["confidence"] = round(min(1.0, entry["confidence"] + candidate["confidence"]), 2)
            entry["common_name"] = entry["common_name"] or candidate["common_name"]
        else:
            merged[name] = dict(candidate, scientific_name=name)
    return sorted(merged.values(), key=lambda c: c["confidence"], reverse=True)


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
            return i
    return None


def _identify_with_openai(images, location):
    raw = openai_client.chat([
        *_image_parts(images),
        {"type": "text", "text": VISION_PROMPT.format(location=location)},
    ], json_reply=True)
    candidates = [_species(c) for c in raw.get("candidates") or [] if isinstance(c, dict)]
    return [_species(raw), *candidates]


def identify_species(images, location):
    if isinstance(images, str):
        images = [images]
    if not 1 <= len(images) <= MAX_IMAGES:
        raise ValueError(f"expected 1 to {MAX_IMAGES} images, got {len(images)}")

    try:
        ranked = _merge_same_species(identify_with_plantnet(images))
    except Exception as err:
        # Never log str(err): the request URL carries the API key.
        log.warning("PlantNet failed (%s); falling back to OpenAI vision", _describe(err))
    else:
        state = _state(ranked)
        if state != "confirm":
            return _result(state, ranked, "plantnet")
        try:
            pick = _adjudicate(images, ranked, location)
        except Exception as err:
            log.warning("OpenAI adjudication failed (%s); keeping PlantNet's order", _describe(err))
            pick = None
        if pick is None:
            return _result(state, ranked, "plantnet")
        return _result(state, ranked, "openai_adjudicated", pick)

    try:
        ranked = _merge_same_species(_identify_with_openai(images, location))
    except Exception as err:
        log.warning("OpenAI vision failed (%s)", _describe(err))
        return _result("unidentified", [], "none")
    return _result(_state(ranked), ranked, "openai_fallback")


def _image_bytes(image):
    if image.startswith(("http://", "https://")):
        response = requests.get(image, timeout=15)
        response.raise_for_status()
        return response.content
    if image.startswith("data:"):
        image = image.split(",", 1)[1]
    return base64.b64decode(image)


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
        timeout=20,
    )
    if response.status_code == 404:
        return []
    response.raise_for_status()
    return [
        {
            "scientific_name": result["species"]["scientificNameWithoutAuthor"],
            "common_name": (result["species"].get("commonNames") or [""])[0],
            "confidence": _confidence(result["score"]),
        }
        for result in response.json().get("results", [])
    ]
