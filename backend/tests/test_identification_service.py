import pytest
import requests

from services import identification_service, openai_client
from services.identification_service import _merge_same_species, identify_species


@pytest.fixture
def model_reply(monkeypatch):
    reply = {"value": {}, "sent": None}

    def fake_chat(content, json_reply=False):
        reply["sent"] = content
        return reply["value"]

    monkeypatch.setattr(openai_client, "chat", fake_chat)
    return reply


def test_openai_fallback_returns_standard_shape(model_reply):
    model_reply["value"] = {
        "scientific_name": "Zamia integrifolia", "common_name": "Coontie", "confidence": 0.87,
        "candidates": [{"scientific_name": "Zamia furfuracea", "common_name": "Cardboard palm", "confidence": 0.1}],
    }
    assert identify_species("abc123", "33139") == {
        "state": "identified",
        "ranked": [
            {"scientific_name": "Zamia integrifolia", "common_name": "Coontie", "confidence": 0.87},
            {"scientific_name": "Zamia furfuracea", "common_name": "Cardboard palm", "confidence": 0.1},
        ],
        "suggested": 0, "source": "openai_fallback", "ai_unavailable": False,
    }


def test_openai_fallback_cleans_messy_reply(model_reply):
    model_reply["value"] = {"scientific_name": "  Plantus alpha ", "common_name": "Alpha",
                            "confidence": "0.871", "candidates": ["junk", {"common_name": "Other", "confidence": 0.3}]}
    ranked = identify_species("abc123", "33139")["ranked"]
    assert ranked[0] == {"scientific_name": "Plantus alpha", "common_name": "Alpha", "confidence": 0.87}
    assert ranked[1] == {"scientific_name": "", "common_name": "Other", "confidence": 0.3}


def test_openai_fallback_missing_fields_is_unidentified(model_reply):
    model_reply["value"] = {"common_name": "Mystery plant"}
    assert identify_species("abc123", "33139")["state"] == "unidentified"


def test_confidence_above_one_is_clamped(model_reply):
    model_reply["value"] = {"scientific_name": "X y", "common_name": "X", "confidence": 1.7}
    assert identify_species("abc123", "33139")["ranked"][0]["confidence"] == 1.0


@pytest.mark.parametrize("value", [-0.2, "abc", None])
def test_bad_confidence_counts_as_zero(model_reply, value):
    model_reply["value"] = {"scientific_name": "X y", "common_name": "X", "confidence": value}
    assert identify_species("abc123", "33139")["state"] == "unidentified"


@pytest.mark.parametrize("image, url", [
    ("abc123", "data:image/jpeg;base64,abc123"),
    ("data:image/png;base64,xyz", "data:image/png;base64,xyz"),
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


def test_merges_names_of_same_species():
    ranked = _merge_same_species([
        {"scientific_name": "Zamia loddigesii", "common_name": "", "confidence": 0.29},
        {"scientific_name": "Zamia integrifolia", "common_name": "Florida Arrowroot", "confidence": 0.13},
        {"scientific_name": "Zamia pumila", "common_name": "Coontie", "confidence": 0.12},
    ])
    assert [(r["scientific_name"], r["confidence"]) for r in ranked] == [
        ("Zamia loddigesii", 0.29), ("Zamia integrifolia", 0.25)]
    assert ranked[1]["common_name"] == "Florida Arrowroot"


def test_merged_confidence_caps_at_one():
    ranked = _merge_same_species([
        {"scientific_name": "Zamia integrifolia", "common_name": "", "confidence": 0.70},
        {"scientific_name": "Zamia pumila", "common_name": "Coontie", "confidence": 0.45},
    ])
    assert ranked == [{"scientific_name": "Zamia integrifolia", "common_name": "Coontie", "confidence": 1.0}]


def test_unknown_names_are_not_merged():
    ranked = [dict(A, scientific_name="Plantus alpha"), dict(B, scientific_name="Plantus beta")]
    assert _merge_same_species(ranked) == ranked


@pytest.mark.parametrize("top, state", [
    (0.01, "unidentified"), (0.19, "unidentified"), (0.20, "confirm"), (0.79, "confirm"), (0.96, "identified")])
def test_state_from_plantnet_score(plantnet, openai, top, state):
    plantnet["ranked"] = [dict(C, confidence=top)]
    assert identify_species("img", ZIP)["state"] == state


def test_unidentified_never_asks_openai(plantnet, openai):
    plantnet["ranked"] = [dict(C, confidence=0.04)]
    identify_species("img", ZIP)
    assert openai["calls"] == []


def test_close_call_is_confirm(plantnet, openai):
    plantnet["ranked"] = [dict(A, confidence=0.85), dict(B, confidence=0.70)]
    assert identify_species("img", ZIP)["state"] == "confirm"


def test_plantnet_confident_is_used_directly(plantnet, openai):
    plantnet["ranked"] = [dict(A, confidence=0.92), dict(B, confidence=0.03)]
    assert identify_species("img", ZIP) == {
        "state": "identified", "ranked": [dict(A, confidence=0.92), dict(B, confidence=0.03)],
        "suggested": 0, "source": "plantnet", "ai_unavailable": False,
    }
    assert openai["calls"] == []


def test_adjudication_only_suggests(plantnet, openai):
    plantnet["ranked"] = [A, B, C]
    openai["reply"] = {"scientific_name": "Zamia furfuracea", "confidence": 0.95}
    result = identify_species(["img1", "img2"], ZIP)
    assert result == {"state": "confirm", "ranked": [A, B, C], "suggested": 1, "source": "openai_adjudicated", "ai_unavailable": False}
    prompt = _text(openai["calls"][0])
    assert ZIP in prompt
    assert all(p["scientific_name"] in prompt for p in (A, B, C))
    assert len(_image_parts(openai["calls"][0])) == 2


def test_adjudicator_off_list_answer_keeps_plantnet_order(plantnet, openai):
    plantnet["ranked"] = [A, B, C]
    openai["reply"] = {"scientific_name": "Quercus virginiana", "confidence": 0.9}
    assert identify_species("img", ZIP) == {"state": "confirm", "ranked": [A, B, C], "suggested": 0, "source": "plantnet", "ai_unavailable": False}


def test_adjudicator_error_keeps_plantnet_order(plantnet, openai):
    plantnet["ranked"] = [A, B, C]
    openai["error"] = openai_client.AIUnavailable("down")
    result = identify_species("img", ZIP)
    assert (result["source"], result["suggested"], result["state"]) == ("plantnet", 0, "confirm")
    assert result["ai_unavailable"] is True


def test_plantnet_failure_falls_back_to_openai_vision(plantnet, openai):
    plantnet["error"] = RuntimeError("PlantNet down")
    openai["reply"] = {"scientific_name": "Zamia integrifolia", "common_name": "Coontie", "confidence": 0.88}
    result = identify_species("img", ZIP)
    assert (result["source"], result["state"]) == ("openai_fallback", "identified")
    assert result["ranked"][0]["scientific_name"] == "Zamia integrifolia"


def test_plantnet_no_match_is_unidentified_without_openai(plantnet, openai):
    plantnet["ranked"] = []
    assert identify_species("img", ZIP) == {"state": "unidentified", "ranked": [], "suggested": 0, "source": "plantnet", "ai_unavailable": False}
    assert openai["calls"] == []


def test_everything_failing_never_crashes(plantnet, openai):
    plantnet["error"] = RuntimeError("PlantNet down")
    openai["error"] = RuntimeError("OpenAI down")
    assert identify_species("img", ZIP) == {"state": "unidentified", "ranked": [], "suggested": 0, "source": "none", "ai_unavailable": True}


@pytest.mark.parametrize("top, runner_up, expected", [
    (0.92, 0.03, "identified"),
    (0.80, None, "identified"),
    (0.79, None, "confirm"),
    (0.85, 0.72, "confirm"),
    (0.85, 0.69, "identified"),
    (0.10, None, "unidentified"),
])
def test_openai_fallback_uses_same_thresholds(plantnet, openai, top, runner_up, expected):
    plantnet["error"] = RuntimeError("PlantNet down")
    candidates = [] if runner_up is None else [{"scientific_name": "Y y", "common_name": "Y", "confidence": runner_up}]
    openai["reply"] = {"scientific_name": "X x", "common_name": "X", "confidence": top, "candidates": candidates}
    assert identify_species("img", ZIP)["state"] == expected


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


def test_links_are_never_sent_to_openai(model_reply):
    with pytest.raises(ValueError):
        identify_species(["https://example.com/p.jpg"], "33139")
    assert model_reply["sent"] is None
