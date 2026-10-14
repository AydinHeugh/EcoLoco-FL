import pytest

import app as app_module
from services import ai_service, openai_client


@pytest.fixture
def client():
    app_module.app.config["TESTING"] = True
    return app_module.app.test_client()


def test_identify_returns_source_and_why(client, monkeypatch):
    monkeypatch.setattr(ai_service, "identify_species", lambda image, location: {
        "scientific_name": "Schinus terebinthifolia", "common_name": "Brazilian pepper",
        "confidence": 0.93, "candidates": []})
    monkeypatch.setattr(ai_service, "assess_plant", lambda species, status, location: {
        "wildlife_support": "low", "wildlife_support_reason": "", "endangered_status": "not_threatened",
        "is_native": True, "invasive_status": "native", "actions": []})
    response = client.post("/identify", json={"image": "abc", "location": "33139"})
    assert response.status_code == 200
    result = response.get_json()["result"]
    assert result["source"] == "FISC"
    assert result["invasive_status"] == "invasive"
    assert result["why"]


def test_recommend_returns_source_and_why(client, monkeypatch):
    monkeypatch.setattr(openai_client, "chat", lambda content, json_reply=False: [
        {"plant_name": "Coontie", "scientific_name": "Zamia integrifolia", "wildlife_support": "high"}])
    response = client.post("/recommend", json={"location": "33139"})
    assert response.status_code == 200
    item = response.get_json()["result"][0]
    assert item["source"] == "fl_natives"
    assert item["why"]


@pytest.mark.parametrize("body", [{"location": "33139"}, {"image": "abc"}, {"image": "", "location": "33139"}])
def test_identify_requires_image_and_location(client, body):
    assert client.post("/identify", json=body).status_code == 400


def test_dead_local_plants_route_is_gone(client):
    assert client.post("/get_local_plants_endpoints", json={"location": "33139"}).status_code == 404
