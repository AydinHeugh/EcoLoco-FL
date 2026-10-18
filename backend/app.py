import base64
import binascii
import logging
import os

from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from services.ai_service import generate_letter, identify_plant
from services.location_service import geocode, plantings_checked, reverse_zip, round_coords, seen_near, zip_center
from services.plan_service import build_plan

load_dotenv()

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 72 * 1024 * 1024
log = logging.getLogger(__name__)
CORS(app)


def debug_enabled():
    return os.getenv("ECOLOCO_DEV") == "1"


FLORIDA_ONLY = "EcoLoco's plant lists cover Florida only. Enter a Florida ZIP code."


def is_florida_zip(zip_code):
    return isinstance(zip_code, str) and len(zip_code) == 5 and zip_code.isdigit() and 32004 <= int(zip_code) <= 34997


MAX_PHOTO_BYTES = 10 * 1024 * 1024
PHOTO_LINK = "Photos must be uploaded, not links."
PHOTO_TOO_BIG = "Each photo must be 10 MB or smaller."
PHOTO_NOT_IMAGE = "Photos must be JPEG or PNG images."


def _photo_error(image):
    if image.startswith(("http://", "https://")):
        return PHOTO_LINK
    data = image.split(",", 1)[1] if image.startswith("data:") else image
    try:
        raw = base64.b64decode(data, validate=True)
    except (binascii.Error, ValueError):
        return PHOTO_NOT_IMAGE
    if len(raw) > MAX_PHOTO_BYTES:
        return PHOTO_TOO_BIG
    if not raw.startswith((b"\xff\xd8\xff", b"\x89PNG")):
        return PHOTO_NOT_IMAGE
    return None


def _valid_images(images):
    return (
        isinstance(images, list)
        and 1 <= len(images) <= 5
        and all(isinstance(image, str) and image for image in images)
    )


@app.route("/identify", methods=["POST"])
def identify():
    data = request.get_json()
    images = data.get("images")
    if images is None and data.get("image"):
        images = [data["image"]]
    location = data.get("location")

    if not _valid_images(images) or not location:
        return jsonify({"error": "1 to 5 images and a location are required"}), 400
    if not is_florida_zip(location):
        return jsonify({"error": FLORIDA_ONLY}), 400
    for image in images:
        if error := _photo_error(image):
            return jsonify({"error": error}), 400

    result = identify_plant(images, location)
    return jsonify({"result": result})


@app.route("/recommend", methods=["POST"])
def recommend():
    data = request.get_json()
    location = data.get("location")

    if not location:
        return jsonify({"error": "location is required"}), 400
    if not is_florida_zip(location):
        return jsonify({"error": FLORIDA_ONLY}), 400
    checked = plantings_checked(location)
    return jsonify({"result": build_plan([], checked)["add"], "plantings_checked": checked})


@app.route("/plan", methods=["POST"])
def plan():
    data = request.get_json()
    plants = data.get("plants")
    location = data.get("location")
    if not isinstance(plants, list) or not location:
        return jsonify({"error": "plants and location are required"}), 400
    if not is_florida_zip(location):
        return jsonify({"error": FLORIDA_ONLY}), 400
    skip = data.get("skip") or []
    if not isinstance(skip, list) or not all(isinstance(name, str) for name in skip):
        return jsonify({"error": "skip must be a list of scientific names"}), 400
    return jsonify({"result": build_plan(plants, plantings_checked(location), skip)})


NOT_FOUND = "We couldn't find that place. Try your school's ZIP code."
LOOKUP_DOWN = "Couldn't look up that place right now. Type your school's ZIP code instead."


@app.route("/locate", methods=["POST"])
def locate():
    data = request.get_json() or {}
    query = str(data.get("query") or "").strip()
    if len(query) == 5 and query.isdigit():
        if not is_florida_zip(query):
            return jsonify({"error": FLORIDA_ONLY}), 400
        lat, lon = zip_center(query) or (None, None)
        return jsonify({"result": {"lat": lat, "lon": lon, "zip": query}})
    try:
        if "lat" in data or "lon" in data:
            lat, lon = round_coords(data.get("lat"), data.get("lon"))
            place = {"lat": lat, "lon": lon, "zip": reverse_zip(lat, lon)}
        elif query:
            place = geocode(query)
        else:
            return jsonify({"error": "query or lat and lon are required"}), 400
    except ValueError:
        return jsonify({"error": "lat and lon must be numbers"}), 400
    except Exception as err:
        log.warning("Place lookup failed (%s)", type(err).__name__)
        return jsonify({"error": LOOKUP_DOWN}), 503
    if place is None or not place["zip"]:
        return jsonify({"error": NOT_FOUND}), 400
    if not is_florida_zip(place["zip"]):
        return jsonify({"error": FLORIDA_ONLY}), 400
    return jsonify({"result": place})


@app.route("/nearby", methods=["POST"])
def nearby():
    data = request.get_json() or {}
    try:
        lat, lon = round_coords(data.get("lat"), data.get("lon"))
    except ValueError:
        return jsonify({"error": "lat and lon must be numbers"}), 400
    return jsonify({"result": seen_near(lat, lon)})


BAD_PLAN = "The plan is missing details. Make the plan again and retry."


def _has_text(value, key="text"):
    return isinstance(value, dict) and isinstance(value.get(key), str) and bool(value[key])


def _valid_plan(plan):
    remove, add, summary = plan["remove"], plan["add"], plan["summary"]
    if not (isinstance(remove, list) and isinstance(add, list) and isinstance(summary, dict)):
        return False
    if not {"percent_native", "percent_native_with_plan"} <= summary.keys():
        return False
    for card in remove:
        if not (_has_text(card, "plant_name") and _has_text(card.get("removal_safety"))):
            return False
    for card in add:
        if not (_has_text(card, "common_name") and _has_text(card.get("helps"))
                and _has_text(card["helps"].get("source"), "name") and _has_text(card.get("buying"), "ask_for")):
            return False
    return True


@app.route("/letter", methods=["POST"])
def letter():
    data = request.get_json()
    plan = data.get("plan")
    zip_code = data.get("zip_code")
    if not isinstance(plan, dict) or not {"remove", "add", "summary"} <= plan.keys() or not zip_code:
        return jsonify({"error": "plan and zip_code are required"}), 400
    if not is_florida_zip(zip_code):
        return jsonify({"error": FLORIDA_ONLY}), 400
    if not _valid_plan(plan):
        return jsonify({"error": BAD_PLAN}), 400
    plan = dict(plan, add=[card for card in plan["add"] if card.get("in_letter") is not False])
    result, ai_unavailable = generate_letter(plan, zip_code)
    return jsonify({"result": result, "ai_unavailable": ai_unavailable})


if __name__ == "__main__":
    app.run(debug=debug_enabled(), host='0.0.0.0')