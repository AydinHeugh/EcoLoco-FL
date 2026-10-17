import pytest

from services import ai_service, openai_client, usda_service
from tests.helpers import species

ZIP = "33139"


@pytest.fixture
def model(monkeypatch):
    state = {
        "species": species(""),
        "assessment": {
            "wildlife_support": "medium", "wildlife_support_reason": "Feeds some birds.",
            "endangered_status": "not_threatened", "is_native": True, "invasive_status": "native",
            "actions": [{"action": "Plant firebush nearby", "impact": "Feeds hummingbirds."}],
        },
        "assess_calls": [],
        "assess_error": None,
    }
    monkeypatch.setattr(ai_service, "identify_species", lambda image, location: state["species"])

    def fake_assess(species, status, location):
        state["assess_calls"].append(status)
        if state["assess_error"]:
            raise state["assess_error"]
        return state["assessment"]

    monkeypatch.setattr(ai_service, "assess_plant", fake_assess)
    return state


def _says(model, scientific_name, common_name, **assessment):
    model["species"]["ranked"][0].update(scientific_name=scientific_name, common_name=common_name)
    model["assessment"].update(assessment)


def test_database_overrides_model_for_invasive(model):
    _says(model, "Schinus terebinthifolia", "Brazilian pepper", is_native=True, invasive_status="native")
    result = ai_service.identify_plant("img", ZIP)
    assert result["status"] == "invasive"
    assert result["source"] == "FISC"
    assert result["why"]
    assert result["actions"][0]["action"] == "Do not plant or propagate this species"


def test_database_overrides_model_for_native(model):
    _says(model, "Zamia integrifolia", "Coontie", is_native=False, invasive_status="invasive")
    result = ai_service.identify_plant("img", ZIP)
    assert result["status"] == "native"
    assert result["source"] == "fl_natives"
    assert "Atala" in result["why"]
    assert result["actions"] == model["assessment"]["actions"]


@pytest.mark.parametrize("model_says", ["native", "non-native", "invasive"])
def test_ai_cannot_set_status_for_unlisted_plant(model, monkeypatch, model_says):
    monkeypatch.setattr(usda_service, "florida_status", lambda name: None)
    _says(model, "Welwitschia mirabilis", "Tree tumbo", is_native=model_says == "native", invasive_status=model_says)
    result = ai_service.identify_plant("img", ZIP)
    assert result["status"] == "unknown"
    assert result["status_label"] == "Unknown: not on Florida lists"
    assert result["source"] == "unknown"
    assert result["why"] is None
    assert "Do not plant or propagate this species" not in [a["action"] for a in result["actions"]]


def test_result_has_full_contract(model):
    _says(model, "Zamia integrifolia", "Coontie")
    result = ai_service.identify_plant("img", ZIP)
    assert {"plant_name", "scientific_name", "status", "status_label", "source", "source_label", "why",
            "wildlife_support", "confidence", "actions"} <= result.keys()
    assert result["plant_name"] == "Coontie"
    assert result["confidence"] == 0.9
    assert "inat_note" not in result


def test_assess_is_told_the_database_status(model):
    _says(model, "Schinus terebinthifolia", "Brazilian pepper")
    ai_service.identify_plant("img", ZIP)
    assert model["assess_calls"][0]["source"] == "FISC"


def test_messy_model_values_are_cleaned(model):
    _says(model, "Plantus imaginarius", "Made-up plant", invasive_status=" Native ",
          wildlife_support="HIGH", endangered_status="who knows")
    result = ai_service.identify_plant("img", ZIP)
    assert result["status"] == "unknown"
    assert result["wildlife_support"] == "high"
    assert result["endangered_status"] == "unknown"


def test_assess_plant_prompt_includes_known_status(monkeypatch):
    sent = {}

    def fake_chat(content, json_reply=False):
        sent["prompt"] = content
        return {}

    monkeypatch.setattr(openai_client, "chat", fake_chat)
    species = {"scientific_name": "Schinus terebinthifolia", "common_name": "Brazilian pepper"}
    ai_service.assess_plant(species, {"native": False, "invasive": True, "source": "FISC", "why": "x"}, ZIP)
    assert "invasive" in sent["prompt"] and "FISC" in sent["prompt"] and ZIP in sent["prompt"]


def test_recommendations_drop_invasives_and_add_source_and_why(monkeypatch):
    monkeypatch.setattr(openai_client, "chat", lambda content, json_reply=False: [
        {"plant_name": "Coontie", "scientific_name": "Zamia integrifolia", "wildlife_support": "high"},
        {"plant_name": "Brazilian pepper", "scientific_name": "Schinus terebinthifolius", "wildlife_support": "low"},
        {"plant_name": "Made-up plant", "scientific_name": "Plantus imaginarius", "wildlife_support": "medium"},
    ])
    recs = ai_service.get_plant_recommendations(ZIP)
    assert [r["plant_name"] for r in recs] == ["Coontie", "Made-up plant"]
    assert recs[0]["source"] == "fl_natives" and "Atala" in recs[0]["why"]
    assert recs[1]["source"] == "unknown" and recs[1]["why"] is None


def test_generate_letter_still_works(monkeypatch):
    monkeypatch.setattr(openai_client, "chat", lambda content, json_reply=False: "They feed bees.")
    letter = ai_service.generate_letter(["Coontie", "Firebush"], 42, ZIP)
    assert "Coontie and Firebush" in letter
    assert "They feed bees." in letter
    assert "42 out of 100" in letter


def test_identify_plant_exposes_id_source_and_state(model):
    _says(model, "Zamia integrifolia", "Coontie")
    model["species"].update(source="openai_adjudicated", state="confirm")
    result = ai_service.identify_plant(["img1", "img2"], ZIP)
    assert result["id_source"] == "openai_adjudicated"
    assert result["state"] == "confirm"
    assert result["source"] == "fl_natives"


def test_unidentified_returns_message_and_no_options(model):
    model["species"] = {"state": "unidentified", "ranked": [], "suggested": 0, "source": "plantnet"}
    result = ai_service.identify_plant("img", ZIP)
    assert result["state"] == "unidentified"
    assert result["options"] == []
    assert result["message"] == "Couldn't identify this. Try a close-up of one leaf, or a flower"
    assert result["status"] == "unknown"
    assert result["plant_name"] == ""
    assert model["assess_calls"] == []


def test_confirm_returns_options_with_status(model, monkeypatch):
    monkeypatch.setattr(usda_service, "florida_status", lambda name: None)
    model["species"] = species("Zamia loddigesii", "", 0.29, "confirm",
                               [{"scientific_name": "Zamia integrifolia", "common_name": "Coontie", "confidence": 0.25}])
    model["species"]["suggested"] = 1
    result = ai_service.identify_plant("img", ZIP)
    assert [o["plant_name"] for o in result["options"]] == ["Zamia loddigesii", "Coontie"]
    assert [o["status_label"] for o in result["options"]] == ["Unknown: not on Florida lists", "Native"]
    assert result["suggested"] == 1
    assert result["message"] is None
    assert result["plant_name"] == "Zamia loddigesii"


def test_identified_has_single_option(model):
    _says(model, "Schinus terebinthifolia", "Brazilian pepper")
    result = ai_service.identify_plant("img", ZIP)
    assert [o["scientific_name"] for o in result["options"]] == ["Schinus terebinthifolia"]


def _ai_down(model):
    model["assess_error"] = openai_client.AIUnavailable("RateLimitError")


def test_scan_survives_openai_outage(model):
    _says(model, "Schinus terebinthifolia", "Brazilian pepper")
    _ai_down(model)
    result = ai_service.identify_plant("img", ZIP)
    assert result["status"] == "invasive"
    assert result["source"] == "FISC"
    assert result["why"]
    assert result["wildlife_support"] == "unknown"
    assert result["wildlife_support_reason"] == ""
    assert result["endangered_status"] == "unknown"
    assert result["actions"][0]["action"] == "Do not plant or propagate this species"
    assert result["ai_unavailable"] is True


def test_scan_native_without_ai_has_no_actions(model):
    _says(model, "Zamia integrifolia", "Coontie")
    _ai_down(model)
    result = ai_service.identify_plant("img", ZIP)
    assert result["status"] == "native"
    assert result["actions"] == []
    assert result["ai_unavailable"] is True


def test_scan_unknown_plant_without_ai(model):
    _says(model, "Plantus imaginarius", "Made-up plant")
    _ai_down(model)
    result = ai_service.identify_plant("img", ZIP)
    assert result["status"] == "unknown"
    assert result["source"] == "unknown"


def test_normal_scan_has_ai_unavailable_false(model):
    _says(model, "Zamia integrifolia", "Coontie")
    assert ai_service.identify_plant("img", ZIP)["ai_unavailable"] is False


def test_assess_returning_a_list_degrades(monkeypatch):
    monkeypatch.setattr(ai_service, "identify_species", lambda images, location: species("Zamia integrifolia", "Coontie"))
    monkeypatch.setattr(openai_client, "chat", lambda content, json_reply=False: ["not", "a", "dict"])
    result = ai_service.identify_plant("img", ZIP)
    assert result["ai_unavailable"] is True
    assert result["wildlife_support"] == "unknown"


def test_fallback_recommendations_come_from_natives():
    recs = ai_service.fallback_recommendations(ZIP)
    assert len(recs) == 11
    assert all(r["source"] == "fl_natives" and r["why"] and r["wildlife_support"] == "unknown" for r in recs)
    assert recs[0]["plant_name"] == "Coontie"
    assert all({"problem", "action", "impact"} <= r.keys() for r in recs[:3])
    assert all("benefit" in r for r in recs[3:])


def test_letter_without_ai_uses_why_lines():
    letter = ai_service.generate_letter_without_ai(["Coontie", "Firebush"], 42, ZIP)
    assert "Coontie and Firebush" in letter
    assert "Atala" in letter
    assert "42 out of 100" in letter


def test_letter_without_ai_unknown_plants_uses_generic_sentence():
    letter = ai_service.generate_letter_without_ai(["Mystery plant"], 42, ZIP)
    assert "Mystery plant" in letter
    assert "food and shelter" in letter


def test_usda_non_native_scan_is_non_native(model, monkeypatch):
    monkeypatch.setattr(usda_service, "florida_status", lambda name: "introduced")
    _says(model, "Ficus benjamina", "Weeping fig", is_native=True, invasive_status="native")
    result = ai_service.identify_plant("img", ZIP)
    assert result["status"] == "non-native"
    assert result["source"] == "USDA"


def test_recommendations_drop_usda_non_natives(monkeypatch):
    monkeypatch.setattr(usda_service, "florida_status", lambda name: "introduced")
    monkeypatch.setattr(openai_client, "chat", lambda content, json_reply=False: [
        {"plant_name": "Coontie", "scientific_name": "Zamia integrifolia", "wildlife_support": "high"},
        {"plant_name": "Weeping fig", "scientific_name": "Ficus benjamina", "wildlife_support": "low"},
    ])
    assert [r["plant_name"] for r in ai_service.get_plant_recommendations(ZIP)] == ["Coontie"]
