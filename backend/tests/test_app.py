import pytest

import app as app_module
from services import ai_service, openai_client
from tests.helpers import species


@pytest.fixture
def client():
    app_module.app.config["TESTING"] = True
    return app_module.app.test_client()


def test_identify_returns_source_and_why(client, monkeypatch):
    monkeypatch.setattr(ai_service, "identify_species", lambda image, location: species("Schinus terebinthifolia", "Brazilian pepper", 0.93))
    monkeypatch.setattr(ai_service, "assess_plant", lambda species, status, location: {
        "wildlife_support": "low", "wildlife_support_reason": "", "endangered_status": "not_threatened",
        "is_native": True, "invasive_status": "native", "actions": []})
    response = client.post("/identify", json={"image": "abc", "location": "33139"})
    assert response.status_code == 200
    result = response.get_json()["result"]
    assert result["source"] == "FISC"
    assert result["status"] == "invasive"
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


@pytest.fixture
def species_spy(monkeypatch):
    received = []
    monkeypatch.setattr(ai_service, "identify_species", lambda images, location: received.append(images) or species("Zamia integrifolia", "Coontie"))
    monkeypatch.setattr(ai_service, "assess_plant", lambda species, status, location: {})
    return received


def test_identify_accepts_multiple_images(client, species_spy):
    response = client.post("/identify", json={"images": ["a", "b", "c"], "location": "33139"})
    assert response.status_code == 200
    assert species_spy == [["a", "b", "c"]]
    result = response.get_json()["result"]
    assert result["id_source"] == "plantnet"
    assert result["state"] == "identified"


def test_identify_still_accepts_single_image(client, species_spy):
    assert client.post("/identify", json={"image": "a", "location": "33139"}).status_code == 200
    assert species_spy == [["a"]]


@pytest.mark.parametrize("images", [[], ["a"] * 6, [""], ["a", 5], "a"])
def test_identify_rejects_bad_image_counts(client, species_spy, images):
    assert client.post("/identify", json={"images": images, "location": "33139"}).status_code == 400
    assert species_spy == []


def _ai_down(monkeypatch):
    def unavailable(content, json_reply=False):
        raise openai_client.AIUnavailable("RateLimitError")
    monkeypatch.setattr(openai_client, "chat", unavailable)


def test_identify_survives_ai_down(client, monkeypatch):
    monkeypatch.setattr(ai_service, "identify_species", lambda images, location: species("Schinus terebinthifolia", "Brazilian pepper", 0.9))
    _ai_down(monkeypatch)
    response = client.post("/identify", json={"image": "abc", "location": "33139"})
    assert response.status_code == 200
    result = response.get_json()["result"]
    assert result["ai_unavailable"] is True
    assert result["source"] == "FISC"


def test_recommend_falls_back_when_ai_down(client, monkeypatch):
    _ai_down(monkeypatch)
    response = client.post("/recommend", json={"location": "33139"})
    assert response.status_code == 200
    body = response.get_json()
    assert body["ai_unavailable"] is True
    assert body["result"][0]["source"] == "fl_natives"


def test_recommend_reports_ai_available(client, monkeypatch):
    monkeypatch.setattr(openai_client, "chat", lambda content, json_reply=False: [
        {"plant_name": "Coontie", "scientific_name": "Zamia integrifolia", "wildlife_support": "high"}])
    assert client.post("/recommend", json={"location": "33139"}).get_json()["ai_unavailable"] is False


def test_letter_falls_back_when_ai_down(client, monkeypatch):
    _ai_down(monkeypatch)
    response = client.post("/letter", json={"plant_names": ["Coontie"], "zip_code": "33139",
                                            "summary": {"percent_native": 50, "percent_native_with_plan": 75}})
    assert response.status_code == 200
    body = response.get_json()
    assert body["ai_unavailable"] is True
    assert "Coontie" in body["result"]


def test_debug_off_by_default(monkeypatch):
    monkeypatch.delenv("ECOLOCO_DEV", raising=False)
    assert app_module.debug_enabled() is False


@pytest.mark.parametrize("value, expected", [("1", True), ("0", False), ("", False)])
def test_debug_on_only_with_dev_flag(monkeypatch, value, expected):
    monkeypatch.setenv("ECOLOCO_DEV", value)
    assert app_module.debug_enabled() is expected


def test_summary_counts_statuses(client):
    response = client.post("/summary", json={"plants": [
        {"scientific_name": "Zamia pumila"}, {"scientific_name": "Schinus terebinthifolius"}]})
    assert response.status_code == 200
    result = response.get_json()["result"]
    assert result["counts"] == {"native": 1, "non_native": 0, "invasive": 1, "unknown": 0}
    assert result["percent_native"] == 50
    assert result["percent_native_with_plan"] == 100


def test_summary_requires_plants(client):
    response = client.post("/summary", json={"plants": []})
    assert response.status_code == 400
    assert response.get_json()["error"] == "plants list is required"


def test_score_route_is_gone(client):
    assert client.post("/score", json={"plants": [{"name": "x"}]}).status_code == 404
