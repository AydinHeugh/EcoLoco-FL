from services import openai_client

PROMPT = """Identify the plant in this photo, taken near US ZIP code {location}.

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


def identify_species(image, location):
    raw = openai_client.chat([
        {"type": "image_url", "image_url": {"url": _image_url(image)}},
        {"type": "text", "text": PROMPT.format(location=location)},
    ], json_reply=True)
    result = _species(raw)
    result["candidates"] = [_species(c) for c in raw.get("candidates") or [] if isinstance(c, dict)]
    return result
