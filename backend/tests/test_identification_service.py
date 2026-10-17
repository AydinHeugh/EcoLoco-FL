import pytest
import requests

from services import identification_service, openai_client
from services.identification_service import identify_species


@pytest.fixture
def model_reply(monkeypatch):
    reply = {"value": {}, "sent": None}

    def fake_chat(content, json_reply=False):
        reply["sent"] = content
        return reply["value"]

    monkeypatch.setattr(openai_client, "chat", fake_chat)
    return reply


def test_identify_species_returns_standard_shape(model_reply):
    model_reply["value"] = {
        "scientific_name": "Zamia integrifolia", "common_name": "Coontie", "confidence": 0.87,
        "candidates": [{"scientific_name": "Zamia furfuracea", "common_name": "Cardboard palm", "confidence": 0.1}],
    }
    assert identify_species("abc123", "33139") == {
        "scientific_name": "Zamia integrifolia", "common_name": "Coontie", "confidence": 0.87,
        "candidates": [{"scientific_name": "Zamia furfuracea", "common_name": "Cardboard palm", "confidence": 0.1}],
        "source": "openai_fallback", "needs_confirmation": False,
    }


def test_identify_species_cleans_messy_reply(model_reply):
    model_reply["value"] = {"scientific_name": "  Zamia integrifolia ", "common_name": "Coontie",
                            "confidence": "0.871", "candidates": ["junk", {"common_name": "Other"}]}
    result = identify_species("abc123", "33139")
    assert result["scientific_name"] == "Zamia integrifolia"
    assert result["confidence"] == 0.87
    assert result["candidates"] == [{"scientific_name": "", "common_name": "Other", "confidence": 0.0}]


def test_identify_species_survives_missing_fields(model_reply):
    model_reply["value"] = {"common_name": "Mystery plant"}
    assert identify_species("abc123", "33139") == {
        "scientific_name": "", "common_name": "Mystery plant", "confidence": 0.0, "candidates": [],
        "source": "openai_fallback", "needs_confirmation": True}


@pytest.mark.parametrize("value, expected", [(1.7, 1.0), (-0.2, 0.0), ("abc", 0.0), (None, 0.0)])
def test_confidence_is_clamped(model_reply, value, expected):
    model_reply["value"] = {"scientific_name": "X y", "common_name": "X", "confidence": value}
    assert identify_species("abc123", "33139")["confidence"] == expected


@pytest.mark.parametrize("image, url", [
    ("abc123", "data:image/jpeg;base64,abc123"),
    ("data:image/png;base64,xyz", "data:image/png;base64,xyz"),
    ("https://example.com/p.jpg", "https://example.com/p.jpg"),
])
def test_image_is_sent_as_url(model_reply, image, url):
    identify_species(image, "33139")
    assert model_reply["sent"][0]["image_url"]["url"] == url
    assert "33139" in model_reply["sent"][1]["text"]


ZIP = "33139"
A = {"scientific_name": "Zamia integrifolia", "common_name": "Coontie", "confidence": 0.45}
B = {"scientific_name": "Zamia furfuracea", "common_name": "Cardboard palm", "confidence": 0.40}
C = {"scientific_name": "Dioon edule", "common_name": "Chestnut dioon", "confidence": 0.05}


@pytest.fixture
def plantnet(monkeypatch):
    state = {"ranked": None, "error": None, "images": None}

    def fake_plantnet(images):
        state["images"] = images
        if state["error"]:
            raise state["error"]
        return state["ranked"]

    monkeypatch.setattr(identification_service, "identify_with_plantnet", fake_plantnet)
    return state


@pytest.fixture
def openai(monkeypatch):
    state = {"reply": None, "error": None, "calls": []}

    def fake_chat(content, json_reply=False):
        state["calls"].append(content)
        if state["error"]:
            raise state["error"]
        return state["reply"]

    monkeypatch.setattr(openai_client, "chat", fake_chat)
    return state


def _text(content):
    return " ".join(part["text"] for part in content if part["type"] == "text")


def _image_parts(content):
    return [part for part in content if part["type"] == "image_url"]


def test_plantnet_confident_is_used_directly(plantnet, openai):
    plantnet["ranked"] = [dict(A, confidence=0.92), dict(B, confidence=0.03)]
    assert identify_species("img", ZIP) == {
        "scientific_name": "Zamia integrifolia", "common_name": "Coontie", "confidence": 0.92,
        "candidates": [dict(B, confidence=0.03)], "source": "plantnet", "needs_confirmation": False,
    }
    assert openai["calls"] == []


def test_plantnet_ambiguous_is_adjudicated(plantnet, openai):
    plantnet["ranked"] = [A, B, C]
    openai["reply"] = {"scientific_name": "Zamia furfuracea", "confidence": 0.7}
    result = identify_species(["img1", "img2"], ZIP)
    assert result == {
        "scientific_name": "Zamia furfuracea", "common_name": "Cardboard palm", "confidence": 0.7,
        "candidates": [A, C], "source": "openai_adjudicated", "needs_confirmation": True,
    }
    prompt = _text(openai["calls"][0])
    assert ZIP in prompt
    assert all(p["scientific_name"] in prompt for p in (A, B, C))
    assert len(_image_parts(openai["calls"][0])) == 2


def test_plantnet_low_confidence_single_result_is_adjudicated(plantnet, openai):
    plantnet["ranked"] = [dict(A, confidence=0.6)]
    openai["reply"] = {"scientific_name": "Zamia integrifolia", "confidence": 0.75}
    result = identify_species("img", ZIP)
    assert result["source"] == "openai_adjudicated"
    assert result["confidence"] == 0.75
    assert len(openai["calls"]) == 1


def test_adjudicator_off_list_answer_keeps_plantnet_top(plantnet, openai):
    plantnet["ranked"] = [A, B, C]
    openai["reply"] = {"scientific_name": "Quercus virginiana", "confidence": 0.9}
    result = identify_species("img", ZIP)
    assert result["source"] == "plantnet"
    assert result["scientific_name"] == "Zamia integrifolia"
    assert result["confidence"] == 0.45
    assert result["candidates"] == [B, C]
    assert result["needs_confirmation"] is True


def test_adjudicator_error_keeps_plantnet_top(plantnet, openai):
    plantnet["ranked"] = [A, B, C]
    openai["error"] = RuntimeError("OpenAI down")
    result = identify_species("img", ZIP)
    assert result["source"] == "plantnet"
    assert result["scientific_name"] == "Zamia integrifolia"
    assert result["needs_confirmation"] is True


def test_plantnet_failure_falls_back_to_openai_vision(plantnet, openai):
    plantnet["error"] = RuntimeError("PlantNet down")
    openai["reply"] = {"scientific_name": "Zamia integrifolia", "common_name": "Coontie", "confidence": 0.88}
    result = identify_species("img", ZIP)
    assert result["source"] == "openai_fallback"
    assert result["scientific_name"] == "Zamia integrifolia"
    assert result["needs_confirmation"] is False


def test_plantnet_empty_result_falls_back(plantnet, openai):
    plantnet["ranked"] = []
    openai["reply"] = {"scientific_name": "Zamia integrifolia", "common_name": "Coontie", "confidence": 0.88}
    assert identify_species("img", ZIP)["source"] == "openai_fallback"


def test_everything_failing_never_crashes(plantnet, openai):
    plantnet["error"] = RuntimeError("PlantNet down")
    openai["error"] = RuntimeError("OpenAI down")
    assert identify_species("img", ZIP) == {
        "scientific_name": "", "common_name": "", "confidence": 0.0, "candidates": [],
        "source": "none", "needs_confirmation": True,
    }


@pytest.mark.parametrize("top, runner_up, expected", [
    (0.92, 0.03, False),
    (0.80, None, False),
    (0.79, None, True),
    (0.85, 0.72, True),
    (0.85, 0.69, False),
])
def test_needs_confirmation(plantnet, openai, top, runner_up, expected):
    plantnet["error"] = RuntimeError("PlantNet down")
    candidates = [] if runner_up is None else [{"scientific_name": "Y y", "common_name": "Y", "confidence": runner_up}]
    openai["reply"] = {"scientific_name": "X x", "common_name": "X", "confidence": top, "candidates": candidates}
    assert identify_species("img", ZIP)["needs_confirmation"] is expected


def test_multiple_images_reach_both_identifiers(plantnet, openai):
    plantnet["error"] = RuntimeError("PlantNet down")
    openai["reply"] = {"scientific_name": "X x", "common_name": "X", "confidence": 0.9}
    identify_species(["img1", "img2", "img3"], ZIP)
    assert plantnet["images"] == ["img1", "img2", "img3"]
    assert len(_image_parts(openai["calls"][0])) == 3


@pytest.mark.parametrize("images", [[], ["img"] * 6])
def test_image_count_outside_1_to_5_raises(plantnet, openai, images):
    with pytest.raises(ValueError):
        identify_species(images, ZIP)


def test_plantnet_failure_log_never_contains_key(plantnet, openai, caplog):
    plantnet["error"] = requests.ConnectionError(
        "Max retries exceeded with url: /v2/identify/all?api-key=test-key&nb-results=5")
    openai["reply"] = {"scientific_name": "X x", "common_name": "X", "confidence": 0.9}
    identify_species("img", ZIP)
    assert "PlantNet" in caplog.text
    assert "test-key" not in caplog.text
