from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from services.ai_service import identify_plant, get_plant_recommendations, generate_letter
from services.score_service import calculate_biodiversity_score

load_dotenv()

app = Flask(__name__)
CORS(app)


@app.route("/identify", methods=["POST"])
def identify():
    data = request.get_json()
    image = data.get("image")
    location = data.get("location")

    if not image or not location:
        return jsonify({"error": "image and location are required"}), 400

    result = identify_plant(image, location)
    return jsonify({"result": result})


@app.route("/recommend", methods=["POST"])
def recommend():
    data = request.get_json()
    location = data.get("location")

    if not location:
        return jsonify({"error": "location is required"}), 400

    result = get_plant_recommendations(location)
    return jsonify({"result": result})


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

    result = generate_letter(plant_names, score, zip_code)
    return jsonify({"result": result})


if __name__ == "__main__":
    app.run(debug=True, host='0.0.0.0')