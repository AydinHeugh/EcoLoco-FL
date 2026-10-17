import os

from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from services.ai_service import generate_letter, identify_plant
from services.plan_service import build_plan

load_dotenv()

app = Flask(__name__)
CORS(app)


def debug_enabled():
    return os.getenv("ECOLOCO_DEV") == "1"


FLORIDA_ONLY = "EcoLoco's plant lists cover Florida only. Enter a Florida ZIP code."


def is_florida_zip(zip_code):
    return isinstance(zip_code, str) and len(zip_code) == 5 and zip_code.isdigit() and 32004 <= int(zip_code) <= 34997


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
    return jsonify({"result": build_plan([])["add"]})


@app.route("/plan", methods=["POST"])
def plan():
    data = request.get_json()
    plants = data.get("plants")
    location = data.get("location")
    if not isinstance(plants, list) or not location:
        return jsonify({"error": "plants and location are required"}), 400
    if not is_florida_zip(location):
        return jsonify({"error": FLORIDA_ONLY}), 400
    return jsonify({"result": build_plan(plants)})


@app.route("/letter", methods=["POST"])
def letter():
    data = request.get_json()
    plan = data.get("plan")
    zip_code = data.get("zip_code")
    if not isinstance(plan, dict) or not {"remove", "add", "summary"} <= plan.keys() or not zip_code:
        return jsonify({"error": "plan and zip_code are required"}), 400
    result, ai_unavailable = generate_letter(plan, zip_code)
    return jsonify({"result": result, "ai_unavailable": ai_unavailable})


if __name__ == "__main__":
    app.run(debug=debug_enabled(), host='0.0.0.0')