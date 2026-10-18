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


def test_identify_species_returns_standard_shape(model_reply):
    model_reply["value"] = {
        "scientific_name": "Zamia integrifolia", "common_name": "Coontie", "confidence": 0.87,
        "candidates": [{"scientific_name": "Zamia furfuracea", "common_name": "Cardboard palm", "confidence": 0.1}],
    }
    assert identify_species("abc123", "33139") == {
        "scientific_name": "Zamia integrifolia", "common_name": "Coontie", "confidence": 0.87,
        "candidates": [{"scientific_name": "Zamia furfuracea", "common_name": "Cardboard palm", "confidence": 0.1}],
        "source": "openai_fallback", "needs_confirmation": False,
        "state": "identified", "suggested": 0, "ai_unavailable": False,
    }


def test_identify_species_cleans_messy_reply(model_reply):
    model_reply["value"] = {"scientific_name": "  Zamia integrifolia ", "common_name": "Coontie",
                            "confidence": "0.871", "candidates": ["junk", {"common_name": "Other"}]}
    result = identify_species("abc123", "33139")
    assert result["scientific_name"] == "Zamia integrifolia"
    assert result["confidence"] == 0.871
    assert result["candidates"] == []


def test_identify_species_survives_missing_fields(model_reply):
    model_reply["value"] = {"common_name": "Mystery plant"}
    assert identify_species("abc123", "33139") == {
        "scientific_name": "", "common_name": "", "confidence": 0.0, "candidates": [],
        "source": "openai_fallback", "needs_confirmation": True,
        "state": "unidentified", "suggested": 0, "ai_unavailable": False}


@pytest.mark.parametrize("value, expected", [(1.7, 1.0), (-0.2, 0.0), ("abc", 0.0), (None, 0.0), (True, 0.0)])
def test_confidence_is_clamped(model_reply, value, expected):
    model_reply["value"] = {"scientific_name": "X y", "common_name": "X", "confidence": value}
    assert identify_species("abc123", "33139")["confidence"] == expected


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


def test_plantnet_confident_is_used_directly(plantnet, openai):
    plantnet["ranked"] = [dict(A, confidence=0.92), dict(B, confidence=0.03)]
    assert identify_species("img", ZIP) == {
        "scientific_name": "Zamia integrifolia", "common_name": "Coontie", "confidence": 0.92,
        "candidates": [dict(B, confidence=0.03)], "source": "plantnet", "needs_confirmation": False,
        "state": "identified", "suggested": 0, "ai_unavailable": False,
    }
    assert openai["calls"] == []


def test_plantnet_ambiguous_is_adjudicated(plantnet, openai):
    plantnet["ranked"] = [A, B, C]
    openai["reply"] = {"scientific_name": "Zamia furfuracea", "confidence": 0.7}
    result = identify_species(["img1", "img2"], ZIP)
    assert result == {
        "scientific_name": "Zamia integrifolia", "common_name": "Coontie", "confidence": 0.45,
        "candidates": [B, C], "source": "openai_adjudicated", "needs_confirmation": True,
        "state": "confirm", "suggested": 1, "ai_unavailable": False,
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
    assert result["confidence"] == 0.6
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


def test_plantnet_empty_result_stays_unidentified_without_fallback(plantnet, openai):
    plantnet["ranked"] = []
    openai["reply"] = {"scientific_name": "Zamia integrifolia", "common_name": "Coontie", "confidence": 0.88}
    result = identify_species("img", ZIP)
    assert result["source"] == "plantnet"
    assert result["state"] == "unidentified"
    assert result["scientific_name"] == ""
    assert result["candidates"] == []
    assert openai["calls"] == []


def test_everything_failing_never_crashes(plantnet, openai):
    plantnet["error"] = RuntimeError("PlantNet down")
    openai["error"] = RuntimeError("OpenAI down")
    assert identify_species("img", ZIP) == {
        "scientific_name": "", "common_name": "", "confidence": 0.0, "candidates": [],
        "source": "none", "needs_confirmation": True,
        "state": "unidentified", "suggested": 0, "ai_unavailable": True,
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


@pytest.mark.parametrize("image", ["http://127.0.0.1/internal", "https://example.com/p.jpg", "file:///etc/passwd"])
def test_remote_image_urls_never_reach_providers(plantnet, openai, image):
    with pytest.raises(ValueError):
        identify_species(image, ZIP)
    assert plantnet["images"] is None
    assert openai["calls"] == []


@pytest.mark.parametrize("value", [float("nan"), float("inf"), float("-inf")])
def test_nonfinite_confidence_cannot_become_certain(model_reply, value):
    model_reply["value"] = {"scientific_name": "Zamia integrifolia", "confidence": value}
    result = identify_species("abc123", ZIP)
    assert result["confidence"] == 0
    assert result["needs_confirmation"] is True


@pytest.mark.parametrize("reply", [[], None, "bad", 9])
def test_malformed_vision_response_recovers(plantnet, openai, reply):
    plantnet["error"] = RuntimeError("PlantNet down")
    openai["reply"] = reply
    result = identify_species("img", ZIP)
    assert result["scientific_name"] == ""
    assert result["needs_confirmation"] is True


@pytest.mark.parametrize("top, expected", [(0.0, "unidentified"), (0.1999, "unidentified"), (0.20, "confirm"), (0.7999, "confirm"), (0.80, "identified")])
def test_provider_thresholds_preserve_real_scores(plantnet, openai, top, expected):
    plantnet["ranked"] = [dict(A, confidence=top)]
    openai["reply"] = {"scientific_name": A["scientific_name"], "confidence": 0.99}
    result = identify_species("img", ZIP)
    assert result["state"] == expected
    if expected == "unidentified":
        assert result["scientific_name"] == ""
        assert result["candidates"] == []
        assert openai["calls"] == []
    else:
        assert result["confidence"] == top


def test_synonym_dedup_keeps_maximum_not_sum_of_provider_scores():
    ranked = _merge_same_species([
        {"scientific_name": "Zamia floridana", "common_name": "", "confidence": 0.45},
        {"scientific_name": "Zamia integrifolia", "common_name": "Coontie", "confidence": 0.41},
    ], ZIP)
    assert ranked == [{"scientific_name": "Zamia integrifolia", "common_name": "Coontie", "confidence": 0.45}]


def test_repeated_llm_alternatives_cannot_become_confident(plantnet, openai):
    plantnet["error"] = RuntimeError("PlantNet down")
    openai["reply"] = {"scientific_name": "Zamia integrifolia", "confidence": 0.3, "candidates": [
        {"scientific_name": "Zamia floridana", "confidence": 0.3},
        {"scientific_name": "ZAMIA INTEGRIFOLIA", "confidence": 0.3},
    ]}
    result = identify_species("img", ZIP)
    assert result["state"] == "confirm"
    assert result["confidence"] == 0.3
    assert result["candidates"] == []


def test_low_duplicate_plantnet_scores_cannot_cross_no_match_threshold(plantnet, openai):
    plantnet["ranked"] = [dict(A, confidence=0.12), dict(A, scientific_name="Zamia floridana", confidence=0.11)]
    result = identify_species("img", ZIP)
    assert result["state"] == "unidentified"
    assert openai["calls"] == []


@pytest.mark.parametrize("names", [
    ["Hamelia patens", "Hamelia patens var. patens", "Hamelia patens var. glabra"],
    ["Ficus microcarpa", "Ficus microcarpa subsp. fuyuensis"],
    ["Zamia integrifolia", "Zamia pumila"],
    ["Asclepias tuberosa", "Asclepias tuberosa subsp. rolfsii", "Asclepias tuberosa subsp. imaginaria"],
    ["Pinus elliottii", "Pinus elliottii var. densa"],
    ["Helianthus debilis", "Helianthus debilis subsp. debilis"],
    ["Plantus alpha", "Plantus alpha 'Garden'", "Plantus x alpha"],
])
def test_meaningful_taxonomic_distinctions_are_not_merged(names):
    ranked = _merge_same_species([dict(A, scientific_name=name) for name in names], ZIP)
    assert len(ranked) == len(names)


def test_documented_subspecies_synonym_keeps_precise_identity_and_maximum_score():
    ranked = _merge_same_species([
        dict(A, scientific_name="Asclepias rolfsii", confidence=0.45),
        dict(A, scientific_name="Asclepias tuberosa subsp. rolfsii", confidence=0.41),
    ], ZIP)
    assert len(ranked) == 1
    assert ranked[0]["scientific_name"] == "Asclepias tuberosa subsp. rolfsii"
    assert ranked[0]["confidence"] == 0.45


def test_exact_duplicates_keep_highest_even_when_listed_later():
    ranked = _merge_same_species([dict(A, confidence=0.2), dict(A, confidence=0.7)], ZIP)
    assert ranked[0]["confidence"] == 0.7
    assert len(ranked) == 1


@pytest.mark.parametrize("reply", [[], None, "bad", {"scientific_name": {}}, {"scientific_name": ""}])
def test_malformed_adjudication_does_not_change_match(plantnet, openai, reply):
    plantnet["ranked"] = [A, B]
    openai["reply"] = reply
    result = identify_species("img", ZIP)
    assert result["scientific_name"] == A["scientific_name"]
    assert result["confidence"] == A["confidence"]
    assert result["suggested"] == 0
    assert result["state"] == "confirm"


def test_adjudication_error_preserves_useful_plantnet_match(plantnet, openai):
    plantnet["ranked"] = [A, B]
    openai["error"] = openai_client.AIUnavailable("Timeout")
    result = identify_species("img", ZIP)
    assert result["ai_unavailable"] is True
    assert result["scientific_name"] == A["scientific_name"]
    assert result["confidence"] == A["confidence"]


@pytest.mark.parametrize("images", [None, 9, {}, [None], [True], [""], ["HTTPS://example.com/image.jpg"]])
def test_invalid_image_shapes_are_rejected_before_providers(plantnet, openai, images):
    with pytest.raises(ValueError):
        identify_species(images, ZIP)
    assert plantnet["images"] is None
    assert openai["calls"] == []
