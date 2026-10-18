import os

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
from werkzeug.exceptions import HTTPException

from services.ai_service import confirm_plant, generate_proposal, get_catalog, get_plant_recommendations, identify_plant
from services.location_service import geocode, plantings_checked, reverse_zip, round_coords, seen_near, zip_center
from services.plan_service import build_plan
from services.request_limits import RequestLimits
from services.request_validation import (
    location_field, plant_list, proposal_fields, site_fields, species_list, text_field, validate_images,
)
from services.score_service import METRIC_VERSION, calculate_biodiversity_score

load_dotenv()
app = Flask(__name__)
app.config.update(
    MAX_CONTENT_LENGTH=30 * 1024 * 1024,
    RATE_LIMIT_ENABLED=True,
    IDENTIFY_PER_MINUTE=int(os.getenv("IDENTIFY_PER_MINUTE", "6")),
    IDENTIFY_TOTAL_PER_MINUTE=int(os.getenv("IDENTIFY_TOTAL_PER_MINUTE", "20")),
    IDENTIFY_TOTAL_PER_DAY=int(os.getenv("IDENTIFY_TOTAL_PER_DAY", "200")),
)
allowed_origins = os.getenv(
    "ALLOWED_ORIGINS", "http://localhost:8081,http://127.0.0.1:8081,http://localhost:4173,http://127.0.0.1:4173"
).split(",")
CORS(app, origins=[origin.strip() for origin in allowed_origins if origin.strip()], max_age=600)
limits = RequestLimits()
location_limits = RequestLimits()


def debug_enabled():
    return os.getenv("ECOLOCO_DEV") == "1"


def _body():
    if not request.is_json:
        raise ValueError("Send an application/json request body.")
    data = request.get_json()
    if not isinstance(data, dict):
        raise ValueError("The request body must be a JSON object.")
    return data


@app.errorhandler(ValueError)
def validation_error(error):
    return jsonify(error=str(error), code="invalid_request"), 400


@app.errorhandler(HTTPException)
def http_error(error):
    messages = {413: "Upload is too large. Choose up to five photos, each no larger than 4 MB.",
                400: "The request body is not valid JSON.", 404: "That endpoint does not exist.",
                405: "That request method is not supported."}
    return jsonify(error=messages.get(error.code, error.description), code=f"http_{error.code}"), error.code


@app.errorhandler(Exception)
def unexpected_error(error):
    # Log error types without photos, input or provider credentials.
    app.logger.error("%s failed (%s)", request.path, type(error).__name__)
    return jsonify(error="This request could not be completed. Your saved audit is unchanged; please retry.", code="server_error"), 500


@app.after_request
def response_headers(response):
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response


@app.route("/health", methods=["GET"])
def health():
    return jsonify(result={"status": "ok", "api_version": "2", "metric_version": METRIC_VERSION})


@app.route("/identify", methods=["POST"])
def identify():
    data = _body()
    location = location_field(data.get("location"))
    images = data.get("images")
    if images is None and data.get("image"):
        images = [data["image"]]
    if app.config["RATE_LIMIT_ENABLED"]:
        retry = limits.check(
            request.remote_addr or "unknown", app.config["IDENTIFY_PER_MINUTE"],
            app.config["IDENTIFY_TOTAL_PER_MINUTE"], app.config["IDENTIFY_TOTAL_PER_DAY"],
        )
        if retry:
            response = jsonify(error="Photo identification is temporarily at its request limit. You can still use the plant catalog and saved audits.", code="rate_limited", retry_after=retry)
            response.headers["Retry-After"] = str(retry)
            return response, 429
    images = validate_images(images)
    return jsonify(result=identify_plant(images, location))


@app.route("/confirm", methods=["POST"])
def confirm():
    data = _body()
    location = location_field(data.get("location"))
    name = text_field(data.get("scientific_name"), "Species name", required=True)
    return jsonify(result=confirm_plant(name, location))


@app.route("/catalog", methods=["POST"])
def catalog():
    data = _body()
    location = location_field(data.get("location"))
    return jsonify(result=get_catalog(location))


@app.route("/recommend", methods=["POST"])
def recommend():
    data = _body()
    location = location_field(data.get("location"))
    plants = plant_list(data.get("plants", []))
    site = site_fields(data.get("site"))
    return jsonify(result=get_plant_recommendations(location, plants=plants, site=site), plantings_checked=plantings_checked(location))


@app.route("/plan", methods=["POST"])
def plan():
    data = _body()
    location = location_field(data.get("location"))
    plants = plant_list(data.get("plants"))
    site = site_fields(data.get("site"))
    additions = species_list(data.get("additions", []), "Proposed additions")
    removals = species_list(data.get("removals", []), "Proposed removals")
    return jsonify(result=build_plan(plants, location, site=site, additions=additions, removals=removals),
                   plantings_checked=plantings_checked(location))


def _location_limit():
    if app.config["RATE_LIMIT_ENABLED"]:
        retry = location_limits.check(request.remote_addr or "unknown", 20, 60, 1000)
        if retry:
            response = jsonify(error="Place lookup is temporarily at its request limit. Enter your Florida ZIP directly.",
                               code="rate_limited", retry_after=retry)
            response.headers["Retry-After"] = str(retry)
            return response, 429
    return None


@app.route("/locate", methods=["POST"])
def locate():
    data = _body()
    query = text_field(data.get("query"), "Place", 200)
    coordinates = round_coords(data.get("lat"), data.get("lon")) if "lat" in data or "lon" in data else None
    if not query and coordinates is None:
        raise ValueError("Enter a place or provide latitude and longitude.")
    direct_zip = location_field(query) if len(query) == 5 and query.isascii() and query.isdigit() else None
    if limited := _location_limit():
        return limited
    if direct_zip:
        lat, lon = zip_center(direct_zip) or (None, None)
        place = {"lat": lat, "lon": lon, "zip": direct_zip}
    elif coordinates:
        lat, lon = coordinates
        place = {"lat": lat, "lon": lon, "zip": reverse_zip(lat, lon)}
    else:
        place = geocode(query)
    if not place or not place.get("zip"):
        return jsonify(error="We couldn't find a Florida ZIP for that place. Enter your school's ZIP directly.", code="place_not_found"), 400
    location = location_field(place["zip"])
    return jsonify(result={**place, "zip": location}, plantings_checked=plantings_checked(location))


@app.route("/nearby", methods=["POST"])
def nearby():
    data = _body()
    lat, lon = round_coords(data.get("lat"), data.get("lon"))
    if limited := _location_limit():
        return limited
    return jsonify(result=seen_near(lat, lon),
                   scope_note="Nearby research-grade iNaturalist observations are context, not this survey's inventory or proof of local nativity.")


@app.route("/score", methods=["POST"])
def score():
    data = _body()
    location = location_field(data.get("location"))
    plants = plant_list(data.get("plants"))
    additions = species_list(data.get("additions", []), "Proposed additions")
    removals = species_list(data.get("removals", []), "Proposed removals")
    return jsonify(result=calculate_biodiversity_score(plants, location, additions=additions, removals=removals))


@app.route("/letter", methods=["POST"])
def letter():
    data = _body()
    if "is_sample" in data and not isinstance(data["is_sample"], bool):
        raise ValueError("is_sample must be true or false.")
    payload = {
        "is_sample": data.get("is_sample", False),
        "zip_code": location_field(data.get("zip_code")),
        "plants": plant_list(data.get("plants", [])),
        "plant_names": species_list(data.get("plant_names"), required=True),
        "site": site_fields(data.get("site")),
        "site_name": text_field(data.get("site_name"), "Survey area"),
        "survey_date": text_field(data.get("survey_date"), "Survey date", 40),
        "proposal": proposal_fields(data.get("proposal")),
    }
    return jsonify(result=generate_proposal(payload))


if __name__ == "__main__":
    app.run(debug=debug_enabled(), host="127.0.0.1", port=int(os.getenv("PORT", "5000")))
