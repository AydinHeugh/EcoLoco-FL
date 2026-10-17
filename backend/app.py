import os

from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from services import openai_client
from services.ai_service import (
    fallback_recommendations,
    generate_letter,
    generate_letter_without_ai,
    get_plant_recommendations,
    identify_plant,
)
from services.score_service import calculate_biodiversity_score

load_dotenv()

app = Flask(__name__)
CORS(app)


def debug_enabled():
    return os.getenv("ECOLOCO_DEV") == "1"


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

    result = identify_plant(images, location)
    return jsonify({"result": result})


@app.route("/recommend", methods=["POST"])
def recommend():
    data = request.get_json()
    location = data.get("location")

    if not location:
        return jsonify({"error": "location is required"}), 400

    try:
        result, ai_unavailable = get_plant_recommendations(location), False
    except openai_client.AIUnavailable:
        result, ai_unavailable = fallback_recommendations(location), True
    return jsonify({"result": result, "ai_unavailable": ai_unavailable})


@app.route("/score", methods=["POST"])
def score():
    data = request.get_json()
    plants = data.get("plants")
    if not plants:
        return jsonify({"error": "plants list is required"}), 400
    result = calculate_biodiversity_score(plants)
    return jsonify({"result": result})


@app.route("/letter", methods=["POST"])
def letter():
    data       = request.get_json()
    plant_names = data.get("plant_names")
    score      = data.get("score")
    zip_code   = data.get("zip_code")

    if not plant_names or score is None or not zip_code:
        return jsonify({"error": "plant_names, score, and zip_code are required"}), 400

    try:
        result, ai_unavailable = generate_letter(plant_names, score, zip_code), False
    except openai_client.AIUnavailable:
        result, ai_unavailable = generate_letter_without_ai(plant_names, score, zip_code), True
    return jsonify({"result": result, "ai_unavailable": ai_unavailable})


if __name__ == "__main__":
    app.run(debug=debug_enabled(), host='0.0.0.0')