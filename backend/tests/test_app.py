"""HTTP contracts and complete survey flows using real bundled evidence."""
import base64
import io
import json

import pytest
from PIL import Image

import app as app_module
from services import ai_service, openai_client
from services.request_limits import RequestLimits
from services.score_service import METRIC_VERSION

ZIP = "33431"


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setitem(app_module.app.config, "TESTING", True)
    monkeypatch.setitem(app_module.app.config, "RATE_LIMIT_ENABLED", False)
    monkeypatch.setattr(app_module, "limits", RequestLimits())
    monkeypatch.setattr(openai_client, "chat", lambda *args, **kwargs: pytest.fail("Unexpected provider call"))
    return app_module.app.test_client()


@pytest.fixture
def photo():
    output = io.BytesIO()
    Image.new("RGB", (3, 2), "green").save(output, format="PNG")
    return "data:image/png;base64," + base64.b64encode(output.getvalue()).decode("ascii")


def observed(name, **extra):
    return {"scientific_name": name, "needs_confirmation": False, **extra}


def test_health_matches_actual_metric_without_providers(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.get_json()["result"]["metric_version"] == METRIC_VERSION
    assert response.get_json()["result"]["status"] == "ok"
    assert response.headers["Cache-Control"] == "no-store"
    assert response.headers["X-Content-Type-Options"] == "nosniff"


@pytest.mark.parametrize("route", ["/identify", "/confirm", "/catalog", "/recommend", "/score", "/letter"])
@pytest.mark.parametrize("body", [None, [], "plant", 42, True])
def test_non_object_json_is_a_json_client_error(client, route, body):
    response = client.post(route, data=json.dumps(body), content_type="application/json")
    assert response.status_code == 400
    assert response.is_json and response.get_json()["error"]


@pytest.mark.parametrize("data,content_type", [("{broken", "application/json"), ("{}", "text/plain")])
def test_invalid_json_and_content_type_return_structured_errors(client, data, content_type):
    response = client.post("/score", data=data, content_type=content_type)
    assert response.status_code == 400
    assert response.is_json and response.get_json()["error"]


@pytest.mark.parametrize("route,payload", [
    ("/score", {"plants": []}), ("/recommend", {}), ("/catalog", {}),
    ("/confirm", {"scientific_name": "Zamia integrifolia"}),
    ("/letter", {"plant_names": ["Zamia integrifolia"]}),
])
def test_required_location_at_every_data_endpoint(client, route, payload):
    response = client.post(route, json=payload)
    assert response.status_code == 400
    assert response.get_json()["code"] == "invalid_request"


@pytest.mark.parametrize("zip_code", ["10001", "32000", "99999", "3343", "334٣١", 33431, None])
def test_unsupported_zip_never_reaches_identification(client, monkeypatch, photo, zip_code):
    monkeypatch.setattr(app_module, "identify_plant", lambda *args: pytest.fail("Invalid location reached provider"))
    response = client.post("/identify", json={"images": [photo], "location": zip_code})
    assert response.status_code == 400 and response.is_json


@pytest.mark.parametrize("images", [[], ["x"] * 6, [""], [5], "photo", ["https://example.com/plant.jpg"], ["http://127.0.0.1:8000/internal"], ["file:///etc/passwd"], ["not base64"]])
def test_rejected_images_never_reach_provider(client, monkeypatch, images):
    monkeypatch.setattr(app_module, "identify_plant", lambda *args: pytest.fail("Invalid image reached provider"))
    response = client.post("/identify", json={"images": images, "location": ZIP})
    assert response.status_code == 400 and response.is_json


@pytest.mark.parametrize("image_count", [1, 5])
def test_identify_normalizes_photos_and_returns_evidence(client, monkeypatch, photo, image_count):
    received = []
    def identify(images, location):
        received.append((images, location))
        return {"scientific_name": "Zamia integrifolia", "common_name": "Coontie", "confidence": 0.93,
                "candidates": [], "source": "plantnet", "needs_confirmation": False}
    monkeypatch.setattr(ai_service, "identify_species", identify)
    payload = {"location": ZIP, "images": [photo] * image_count}
    if image_count == 1:
        payload["image"] = payload.pop("images")[0]
    response = client.post("/identify", json=payload)
    assert response.status_code == 200
    result = response.get_json()["result"]
    assert result["status_verified"] and result["source_url"] and result["verified_on"]
    assert result["id_source"] == "plantnet" and not result["needs_confirmation"]
    assert result["wildlife_support"] == "documented"
    assert len(received[0][0]) == image_count and received[0][1] == ZIP
    for normalized in received[0][0]:
        assert normalized.startswith("data:image/jpeg;base64,")
        with Image.open(io.BytesIO(base64.b64decode(normalized.split(",", 1)[1]))) as image:
            assert image.format == "JPEG" and image.size == (3, 2)


def test_manual_catalog_confirmation_and_score_without_providers(client):
    response = client.post("/catalog", json={"location": ZIP})
    assert response.status_code == 200
    catalog = response.get_json()["result"]
    assert {entry["invasive_status"] for entry in catalog} == {"native", "non-native", "invasive"}
    assert all(entry["status_verified"] and entry["source_url"] for entry in catalog)
    confirmed = client.post("/confirm", json={"location": ZIP, "scientific_name": "Zamia floridana"}).get_json()["result"]
    assert confirmed["scientific_name"] == "Zamia integrifolia"
    assert confirmed["user_confirmed"] and confirmed["confidence"] is None
    scored = client.post("/score", json={"location": ZIP, "plants": [confirmed]})
    assert scored.status_code == 200
    assert scored.get_json()["result"]["native_share"] == 100


def test_source_truth_overrides_forged_labels_and_unconfirmed_ids(client):
    plants = [observed("Schinus terebinthifolia", invasive_status="native", source="fl_natives", status_verified=True),
              observed("Plantus imaginarius", invasive_status="native", source="FISC", status_verified=True),
              observed("Zamia integrifolia", confidence=0.99, needs_confirmation=True)]
    response = client.post("/score", json={"location": ZIP, "plants": plants})
    assert response.status_code == 200
    result = response.get_json()["result"]
    assert result["native_count"] == 0 and result["invasive_count"] == 1
    assert result["unresolved_count"] == 2 and result["verified_species_count"] == 1
    assert result["species"][0]["source"] == "FISC" and "score" not in result


@pytest.mark.parametrize("plants", [
    ["Coontie"], [{"invasive_status": []}], [{"wildlife_support": {}}],
    pytest.param([{"confidence": 10 ** 1000}], id="huge_confidence"),
    [{}] * 301,
])
def test_bad_observation_fields_return_json_400(client, plants):
    response = client.post("/score", json={"location": ZIP, "plants": plants})
    assert response.status_code == 400
    assert response.get_json()["code"] == "invalid_request"


def test_recommend_project_propose_flow_uses_actual_inventory(client):
    plants = [observed("Zamia integrifolia"), observed("Schinus terebinthifolia")]
    recommended = client.post("/recommend", json={"location": ZIP, "plants": plants, "site": {"space": "large"}})
    assert recommended.status_code == 200
    choices = recommended.get_json()["result"]
    assert choices and all(choice["status_verified"] and choice["source_url"] for choice in choices)
    assert "Zamia integrifolia" not in {choice["scientific_name"] for choice in choices}
    assert all({"problem", "action", "impact", "site_requirements"} <= choice.keys() for choice in choices)
    selected = "Quercus virginiana"
    assert selected in {choice["scientific_name"] for choice in choices}
    result = client.post("/score", json={"location": ZIP, "plants": plants, "additions": [selected]}).get_json()["result"]
    assert result["native_share"] == 50 and result["projected"]["native_share"] == 66.7
    realized = client.post("/score", json={"location": ZIP, "plants": [*plants, observed(selected)]}).get_json()["result"]
    assert result["projected"]["native_share"] == realized["native_share"]
    proposal = client.post("/letter", json={
        "zip_code": ZIP, "plant_names": [selected], "plants": plants, "score": 99,
        "site_name": "West courtyard", "survey_date": "2026-10-17", "is_sample": True,
        "proposal": {"quantity": "One oak", "budget": "$75 pending review", "maintenance": "Eco-club"},
    })
    assert proposal.status_code == 200
    letter = proposal.get_json()["result"]
    assert letter.startswith("SAMPLE PROPOSAL") and "not a real campus survey" in letter
    assert "1 of 2" in letter and "2 of 3" in letter
    assert "West courtyard" in letter and "One oak" in letter and "$75" in letter
    assert "99 out of 100" not in letter and "no improvement has been measured yet" in letter


@pytest.mark.parametrize("name", ["Schinus terebinthifolia", "Plantus imaginarius", "Hamelia patens"])
def test_invalid_planned_species_are_client_errors(client, name):
    projection = client.post("/score", json={"location": ZIP, "plants": [], "additions": [name]})
    proposal = client.post("/letter", json={"zip_code": ZIP, "plant_names": [name]})
    assert projection.status_code == proposal.status_code == 400
    assert projection.is_json and proposal.is_json


@pytest.mark.parametrize("field,value", [("is_sample", "false"), ("is_sample", 1)])
def test_sample_flag_must_be_a_boolean(client, field, value):
    response = client.post("/letter", json={"zip_code": ZIP, "plant_names": ["Zamia integrifolia"], field: value})
    assert response.status_code == 400


def test_quota_skips_provider_and_preserves_catalog_access(client, monkeypatch, photo):
    monkeypatch.setitem(app_module.app.config, "RATE_LIMIT_ENABLED", True)
    monkeypatch.setitem(app_module.app.config, "IDENTIFY_PER_MINUTE", 1)
    calls = []
    monkeypatch.setattr(app_module, "identify_plant", lambda *args: calls.append(args) or {})
    payload = {"location": ZIP, "images": [photo]}
    assert client.post("/identify", json=payload).status_code == 200
    monkeypatch.setattr(app_module, "validate_images", lambda *args: pytest.fail("Quota denial must precede image decoding"))
    blocked = client.post("/identify", json=payload, headers={"X-Forwarded-For": "different-client"})
    assert blocked.status_code == 429 and len(calls) == 1
    assert blocked.get_json()["code"] == "rate_limited"
    assert int(blocked.headers["Retry-After"]) == blocked.get_json()["retry_after"] > 0
    assert client.post("/catalog", json={"location": ZIP}).status_code == 200


def test_http_body_limit_is_json_413_before_provider(client, monkeypatch):
    monkeypatch.setitem(app_module.app.config, "MAX_CONTENT_LENGTH", 1024)
    monkeypatch.setattr(app_module, "identify_plant", lambda *args: pytest.fail("Oversized request reached provider"))
    response = client.post("/identify", json={"location": ZIP, "images": ["A" * 2048]})
    assert response.status_code == 413 and response.get_json()["code"] == "http_413"


def test_unexpected_errors_do_not_echo_private_details(client, monkeypatch, caplog):
    secret = "private-provider-key-and-upload-content"
    def fail(*args):
        raise RuntimeError(secret)
    monkeypatch.setattr(app_module, "get_catalog", fail)
    response = client.post("/catalog", json={"location": ZIP})
    assert response.status_code == 500 and response.get_json()["code"] == "server_error"
    assert secret not in response.get_data(as_text=True) and secret not in caplog.text


def test_missing_route_and_wrong_method_return_json(client):
    assert client.post("/get_local_plants_endpoints", json={}).get_json()["code"] == "http_404"
    assert client.get("/score").get_json()["code"] == "http_405"


@pytest.mark.parametrize("value,expected", [(None, False), ("1", True), ("0", False), ("", False)])
def test_debug_is_opt_in_only(monkeypatch, value, expected):
    if value is None:
        monkeypatch.delenv("ECOLOCO_DEV", raising=False)
    else:
        monkeypatch.setenv("ECOLOCO_DEV", value)
    assert app_module.debug_enabled() is expected
