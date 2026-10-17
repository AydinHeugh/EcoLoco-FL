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
    response = client.post("/identify", json={"image": "abc", "location": "33139"})
    assert response.status_code == 200
    result = response.get_json()["result"]
    assert result["source"] == "FISC"
    assert result["status"] == "invasive"
    assert result["why"]


@pytest.mark.parametrize("body", [{"location": "33139"}, {"image": "abc"}, {"image": "", "location": "33139"}])
def test_identify_requires_image_and_location(client, body):
    assert client.post("/identify", json=body).status_code == 400


def test_dead_local_plants_route_is_gone(client):
    assert client.post("/get_local_plants_endpoints", json={"location": "33139"}).status_code == 404


@pytest.fixture
def species_spy(monkeypatch):
    received = []
    monkeypatch.setattr(ai_service, "identify_species", lambda images, location: received.append(images) or species("Zamia integrifolia", "Coontie"))
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
    def unavailable(content, json_reply=False, system=None):
        raise openai_client.AIUnavailable("RateLimitError")
    monkeypatch.setattr(openai_client, "chat", unavailable)


def test_identified_scan_does_not_need_ai(client, monkeypatch):
    monkeypatch.setattr(ai_service, "identify_species", lambda images, location: species("Schinus terebinthifolia", "Brazilian pepper", 0.9))
    _ai_down(monkeypatch)
    response = client.post("/identify", json={"image": "abc", "location": "33139"})
    assert response.status_code == 200
    result = response.get_json()["result"]
    assert result["ai_unavailable"] is False
    assert result["source"] == "FISC"


def test_letter_falls_back_when_ai_down(client, monkeypatch):
    _ai_down(monkeypatch)
    plan = client.post("/plan", json={"location": "33139", "plants": [{"scientific_name": "Schinus terebinthifolius"}]}).get_json()["result"]
    response = client.post("/letter", json={"plan": plan, "zip_code": "33139"})
    assert response.status_code == 200
    body = response.get_json()
    assert body["ai_unavailable"] is True
    assert "Brazilian pepper" in body["result"]


@pytest.mark.parametrize("body", [{"zip_code": "33139"}, {"plan": {"remove": []}}, {"plan": "x", "zip_code": "33139"}])
def test_letter_requires_plan_and_zip(client, body):
    assert client.post("/letter", json=body).status_code == 400


def test_debug_off_by_default(monkeypatch):
    monkeypatch.delenv("ECOLOCO_DEV", raising=False)
    assert app_module.debug_enabled() is False


@pytest.mark.parametrize("value, expected", [("1", True), ("0", False), ("", False)])
def test_debug_on_only_with_dev_flag(monkeypatch, value, expected):
    monkeypatch.setenv("ECOLOCO_DEV", value)
    assert app_module.debug_enabled() is expected


@pytest.mark.parametrize("route", ["/score", "/summary"])
def test_replaced_routes_are_gone(client, route):
    assert client.post(route, json={"plants": [{"name": "x"}]}).status_code == 404


def test_plan_returns_remove_and_add_cards(client):
    response = client.post("/plan", json={"location": "33496", "plants": [{"scientific_name": "Schinus terebinthifolius"}]})
    assert response.status_code == 200
    result = response.get_json()["result"]
    assert [c["plant_name"] for c in result["remove"]] == ["Brazilian pepper"]
    assert {"add", "gaps", "summary"} <= result.keys()


def test_plan_accepts_an_empty_audit(client):
    response = client.post("/plan", json={"location": "33496", "plants": []})
    assert response.status_code == 200
    assert response.get_json()["result"]["remove"] == []


def test_recommend_uses_only_our_data(client, monkeypatch):
    def no_chat(*args, **kwargs):
        raise AssertionError("recommend must not call OpenAI")

    monkeypatch.setattr(openai_client, "chat", no_chat)
    response = client.post("/recommend", json={"location": "33496"})
    assert response.status_code == 200
    assert isinstance(response.get_json()["result"], list)


FLORIDA_ONLY = "EcoLoco's plant lists cover Florida only. Enter a Florida ZIP code."


@pytest.mark.parametrize("zip_code", ["10001", "00000", "3349", "abcde"])
@pytest.mark.parametrize("route, body", [
    ("/plan", {"plants": []}), ("/recommend", {}), ("/identify", {"image": "abc"})])
def test_non_florida_zip_is_rejected(client, route, body, zip_code):
    response = client.post(route, json={**body, "location": zip_code})
    assert response.status_code == 400
    assert response.get_json()["error"] == FLORIDA_ONLY


@pytest.mark.parametrize("zip_code, expected", [("32004", True), ("33496", True), ("34997", True),
                                                ("32003", False), ("34998", False), ("10001", False), ("", False)])
def test_is_florida_zip(zip_code, expected):
    assert app_module.is_florida_zip(zip_code) is expected


def test_plan_includes_why_this_matters(client):
    result = client.post("/plan", json={"location": "33496", "plants": []}).get_json()["result"]
    assert 1 <= len(result["why_this_matters"]) <= 4
    assert all(line["source"]["url"].startswith("https://") for line in result["why_this_matters"])


def test_ai_down_is_reported_where_ai_is_used(client, monkeypatch):
    monkeypatch.setattr(ai_service, "identify_species", lambda images, location: dict(
        species("Zamia integrifolia", "Coontie", 0.4, "confirm"), ai_unavailable=True))
    _ai_down(monkeypatch)
    assert client.post("/identify", json={"image": "abc", "location": "33139"}).get_json()["result"]["ai_unavailable"] is True
    plan = client.post("/plan", json={"location": "33139", "plants": []}).get_json()
    assert "ai_unavailable" not in plan and "ai_unavailable" not in plan["result"]
    assert "ai_unavailable" not in client.post("/recommend", json={"location": "33139"}).get_json()
    letter = client.post("/letter", json={"plan": plan["result"], "zip_code": "33139"}).get_json()
    assert letter["ai_unavailable"] is True
