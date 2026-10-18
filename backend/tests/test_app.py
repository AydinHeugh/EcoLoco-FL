import pytest

import app as app_module
from services import ai_service, openai_client
from tests.helpers import PHOTO, species


@pytest.fixture
def client():
    app_module.app.config["TESTING"] = True
    return app_module.app.test_client()


def test_identify_returns_source_and_why(client, monkeypatch):
    monkeypatch.setattr(ai_service, "identify_species", lambda image, location: species("Schinus terebinthifolia", "Brazilian pepper", 0.93))
    response = client.post("/identify", json={"image": PHOTO, "location": "33139"})
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
    response = client.post("/identify", json={"images": [PHOTO, PHOTO, PHOTO], "location": "33139"})
    assert response.status_code == 200
    assert species_spy == [[PHOTO, PHOTO, PHOTO]]
    result = response.get_json()["result"]
    assert result["id_source"] == "plantnet"
    assert result["state"] == "identified"


def test_identify_still_accepts_single_image(client, species_spy):
    assert client.post("/identify", json={"image": PHOTO, "location": "33139"}).status_code == 200
    assert species_spy == [[PHOTO]]


@pytest.mark.parametrize("images", [[], [PHOTO] * 6, [""], [PHOTO, 5], PHOTO])
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
    response = client.post("/identify", json={"image": PHOTO, "location": "33139"})
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
    ("/plan", {"plants": []}), ("/recommend", {}), ("/identify", {"image": PHOTO})])
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
    assert client.post("/identify", json={"image": PHOTO, "location": "33139"}).get_json()["result"]["ai_unavailable"] is True
    plan = client.post("/plan", json={"location": "33139", "plants": []}).get_json()
    assert "ai_unavailable" not in plan and "ai_unavailable" not in plan["result"]
    assert "ai_unavailable" not in client.post("/recommend", json={"location": "33139"}).get_json()
    letter = client.post("/letter", json={"plan": plan["result"], "zip_code": "33139"}).get_json()
    assert letter["ai_unavailable"] is True


@pytest.fixture
def places(monkeypatch):
    from services import location_service
    calls = []
    monkeypatch.setattr(app_module, "geocode", lambda q: calls.append(("geocode", q)) or (
        {"lat": 26.37, "lon": -80.13, "zip": "33496"} if "Boca" in q or q == "33496" else
        {"lat": 40.75, "lon": -73.99, "zip": "10001"} if q == "10001" else None))
    monkeypatch.setattr(app_module, "reverse_zip", lambda lat, lon: calls.append(("reverse", lat, lon)) or "33496")
    monkeypatch.setattr(app_module, "seen_near", lambda lat, lon: calls.append(("nearby", lat, lon)) or [{"plant_name": "Coontie"}])
    return calls


def test_locate_typed_address(client, places):
    response = client.post("/locate", json={"query": "Boca Raton FL"})
    assert response.get_json()["result"] == {"lat": 26.37, "lon": -80.13, "zip": "33496"}


def test_locate_rounds_device_coordinates_again(client, places):
    response = client.post("/locate", json={"lat": 26.36789, "lon": -80.12345})
    assert response.get_json()["result"] == {"lat": 26.37, "lon": -80.12, "zip": "33496"}
    assert places == [("reverse", 26.37, -80.12)]


def test_locate_outside_florida_is_rejected(client, places):
    response = client.post("/locate", json={"query": "10001"})
    assert response.status_code == 400
    assert response.get_json()["error"] == FLORIDA_ONLY


def test_locate_unknown_place(client, places):
    response = client.post("/locate", json={"query": "zzzz"})
    assert response.status_code == 400
    assert response.get_json()["error"] == "We couldn't find that place. Try your school's ZIP code."


@pytest.mark.parametrize("body", [{}, {"lat": "x", "lon": 1}, {"query": ""}])
def test_locate_bad_input(client, places, body):
    assert client.post("/locate", json=body).status_code == 400


def test_nearby_rounds_and_returns_plants(client, places):
    response = client.post("/nearby", json={"lat": 26.36789, "lon": -80.12345})
    assert response.get_json()["result"] == [{"plant_name": "Coontie"}]
    assert places == [("nearby", 26.37, -80.12)]


def test_old_inat_service_is_gone():
    import importlib.util
    assert importlib.util.find_spec("services.inat_service") is None


def test_locate_survives_lookup_service_down(client, monkeypatch):
    def down(*args, **kwargs):
        raise RuntimeError("network blocked in tests")

    monkeypatch.setattr(app_module, "geocode", down)
    response = client.post("/locate", json={"query": "Boca Raton"})
    assert response.status_code == 503
    assert response.get_json()["error"] == "Couldn't look up that place right now. Type your school's ZIP code instead."


def test_typed_zip_still_works_when_lookup_is_down(client, monkeypatch):
    def down(*args, **kwargs):
        raise RuntimeError("network blocked in tests")

    monkeypatch.setattr(app_module, "geocode", down)
    response = client.post("/locate", json={"query": "33496"})
    assert response.get_json()["result"] == {"lat": None, "lon": None, "zip": "33496"}


def _no_search(*args, **kwargs):
    raise AssertionError("a typed ZIP must not go through free-text search")


def test_typed_zip_is_used_directly(client, monkeypatch):
    monkeypatch.setattr(app_module, "geocode", _no_search)
    monkeypatch.setattr(app_module, "zip_center", lambda z: (26.71, -80.06))
    assert client.post("/locate", json={"query": "33401"}).get_json()["result"] == {"lat": 26.71, "lon": -80.06, "zip": "33401"}


def test_typed_non_florida_zip_gets_florida_message(client, monkeypatch):
    monkeypatch.setattr(app_module, "geocode", _no_search)
    monkeypatch.setattr(app_module, "zip_center", _no_search)
    response = client.post("/locate", json={"query": "00000"})
    assert response.status_code == 400
    assert response.get_json()["error"] == FLORIDA_ONLY


def test_typed_zip_without_coordinates_still_works(client, monkeypatch):
    monkeypatch.setattr(app_module, "geocode", _no_search)
    monkeypatch.setattr(app_module, "zip_center", lambda z: None)
    assert client.post("/locate", json={"query": "33496"}).get_json()["result"] == {"lat": None, "lon": None, "zip": "33496"}


@pytest.mark.parametrize("link", ["https://example.com/p.jpg", "http://169.254.169.254/latest/meta-data"])
def test_identify_refuses_links(client, species_spy, link):
    response = client.post("/identify", json={"images": [link], "location": "33139"})
    assert response.status_code == 400
    assert response.get_json()["error"] == "Photos must be uploaded, not links."
    assert species_spy == []


def test_identify_refuses_photos_over_10_mb(client, species_spy):
    import base64
    big = base64.b64encode(b"\xff\xd8\xff" + b"0" * (10 * 1024 * 1024)).decode()
    response = client.post("/identify", json={"images": [big], "location": "33139"})
    assert response.status_code == 400
    assert response.get_json()["error"] == "Each photo must be 10 MB or smaller."
    assert species_spy == []


@pytest.mark.parametrize("image", ["not base64 at all!!", "aGVsbG8gd29ybGQ="])
def test_identify_refuses_things_that_are_not_photos(client, species_spy, image):
    response = client.post("/identify", json={"images": [image], "location": "33139"})
    assert response.status_code == 400
    assert response.get_json()["error"] == "Photos must be JPEG or PNG images."
    assert species_spy == []


def test_identify_accepts_data_url_photos(client, species_spy):
    response = client.post("/identify", json={"images": [f"data:image/jpeg;base64,{PHOTO}"], "location": "33139"})
    assert response.status_code == 200


def test_whole_request_size_is_capped(client, monkeypatch):
    monkeypatch.setitem(app_module.app.config, "MAX_CONTENT_LENGTH", 1000)
    response = client.post("/identify", json={"images": [PHOTO * 100], "location": "33139"})
    assert response.status_code == 413


def test_request_cap_fits_five_full_size_photos():
    assert app_module.app.config["MAX_CONTENT_LENGTH"] >= 5 * 10 * 1024 * 1024 * 4 // 3


def _plan(client):
    return client.post("/plan", json={"location": "33139", "plants": [{"scientific_name": "Schinus terebinthifolius"}]}).get_json()["result"]


def test_letter_refuses_non_florida_zip(client):
    response = client.post("/letter", json={"plan": _plan(client), "zip_code": "10001"})
    assert response.status_code == 400
    assert response.get_json()["error"] == FLORIDA_ONLY


@pytest.mark.parametrize("break_it", [
    lambda p: p["remove"][0].pop("removal_safety"),
    lambda p: p["remove"][0].update(plant_name=5),
    lambda p: p["add"].append({"common_name": "X"}),
    lambda p: p["add"].append({"common_name": "X", "helps": {"text": "t"}, "buying": {}}),
    lambda p: p.update(remove="nope"),
    lambda p: p["summary"].pop("percent_native"),
])
def test_letter_refuses_malformed_plans(client, break_it):
    plan = _plan(client)
    break_it(plan)
    response = client.post("/letter", json={"plan": plan, "zip_code": "33139"})
    assert response.status_code == 400
    assert response.get_json()["error"] == "The plan is missing details. Make the plan again and retry."
