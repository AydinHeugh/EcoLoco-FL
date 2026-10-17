import pytest

from services import ai_service, openai_client, usda_service
from services.name_guard import mentions_new_names
from tests.helpers import species

ZIP = "33139"


@pytest.fixture
def model(monkeypatch):
    state = {"species": species(""), "chat_calls": []}
    monkeypatch.setattr(ai_service, "identify_species", lambda image, location: state["species"])

    def no_chat(*args, **kwargs):
        state["chat_calls"].append(args)
        raise AssertionError("identify_plant must not call OpenAI")

    monkeypatch.setattr(openai_client, "chat", no_chat)
    return state


def _says(model, scientific_name, common_name):
    model["species"]["ranked"][0].update(scientific_name=scientific_name, common_name=common_name)


def test_invasive_status_and_removal_safety_from_our_data(model):
    _says(model, "Schinus terebinthifolia", "Brazilian peppertree")
    result = ai_service.identify_plant("img", ZIP)
    assert result["status"] == "invasive"
    assert result["source"] == "FISC"
    assert result["why"]
    assert "poison ivy" in result["removal_safety"]["text"]


def test_native_gets_helps_and_watch_out_from_our_data(model):
    _says(model, "Zamia integrifolia", "Coontie")
    result = ai_service.identify_plant("img", ZIP)
    assert result["status"] == "native"
    assert "atala" in result["helps"]["text"]
    assert result["helps"]["source"]["name"].startswith("Institute for Regional Conservation")
    assert any("dogs" in w["text"] for w in result["watch_out"])


@pytest.mark.parametrize("label", ["Welwitschia mirabilis", "Plantus imaginarius"])
def test_unlisted_plant_is_unknown_and_has_no_facts(model, monkeypatch, label):
    monkeypatch.setattr(usda_service, "florida_status", lambda name: None)
    _says(model, label, "Mystery")
    result = ai_service.identify_plant("img", ZIP)
    assert result["status"] == "unknown"
    assert result["status_label"] == "Unknown: not on Florida lists"
    assert "helps" not in result and "watch_out" not in result


def test_identified_result_never_calls_openai(model):
    _says(model, "Zamia integrifolia", "Coontie")
    ai_service.identify_plant("img", ZIP)
    assert model["chat_calls"] == []


def test_result_has_no_ai_facts(model):
    _says(model, "Zamia integrifolia", "Coontie")
    result = ai_service.identify_plant("img", ZIP)
    for key in ("actions", "wildlife_support", "wildlife_support_reason", "endangered_status", "is_native", "invasive_status"):
        assert key not in result
    assert {"plant_name", "scientific_name", "status", "status_label", "source", "source_label", "why",
            "confidence", "state", "options", "suggested", "message", "id_source", "ai_unavailable"} <= result.keys()


def test_identify_plant_exposes_id_source_and_state(model):
    _says(model, "Zamia integrifolia", "Coontie")
    model["species"].update(source="openai_adjudicated", state="confirm")
    result = ai_service.identify_plant(["img1", "img2"], ZIP)
    assert result["id_source"] == "openai_adjudicated"
    assert result["state"] == "confirm"
    assert result["source"] == "fl_natives"


def test_ai_unavailable_comes_from_the_tiebreaker(model):
    _says(model, "Zamia integrifolia", "Coontie")
    model["species"].update(state="confirm", ai_unavailable=True)
    assert ai_service.identify_plant("img", ZIP)["ai_unavailable"] is True
    model["species"]["ai_unavailable"] = False
    assert ai_service.identify_plant("img", ZIP)["ai_unavailable"] is False


def test_unidentified_returns_message_and_no_options(model):
    model["species"] = {"state": "unidentified", "ranked": [], "suggested": 0, "source": "plantnet", "ai_unavailable": False}
    result = ai_service.identify_plant("img", ZIP)
    assert result["state"] == "unidentified"
    assert result["options"] == []
    assert result["message"] == "Couldn't identify this. Try a close-up of one leaf, or a flower"
    assert result["status"] == "unknown"
    assert result["plant_name"] == ""


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


def test_usda_non_native_scan_is_non_native(model, monkeypatch):
    monkeypatch.setattr(usda_service, "florida_status", lambda name: "introduced")
    _says(model, "Ficus benjamina", "Weeping fig")
    result = ai_service.identify_plant("img", ZIP)
    assert result["status"] == "non-native"
    assert result["source"] == "USDA"


@pytest.fixture
def plan(monkeypatch):
    import json
    from services import plan_service
    from services.species_service import DATA_DIR
    entries = json.loads((DATA_DIR / "fl_recommendations.json").read_text(encoding="utf-8"))["species"]
    monkeypatch.setattr(plan_service, "_recommendations", lambda: [dict(e, verified=True) for e in entries])
    return plan_service.build_plan([{"scientific_name": "Schinus terebinthifolius", "plant_name": "Brazilian peppertree"},
                                    {"scientific_name": "Zamia integrifolia"}])


@pytest.fixture
def rephrase(monkeypatch):
    state = {"reply": None, "system": None}

    def fake_chat(content, json_reply=False, system=None):
        state["system"] = system
        if isinstance(state["reply"], Exception):
            raise state["reply"]
        return state["reply"] if state["reply"] is not None else content.split("\n\n", 1)[1]

    monkeypatch.setattr(openai_client, "chat", fake_chat)
    return state


def test_letter_includes_pepper_removal_and_buying(plan, rephrase):
    letter, ai_unavailable = ai_service.generate_letter(plan, ZIP)
    assert ai_unavailable is False
    assert "Brazilian pepper" in letter and "poison ivy" in letter
    assert "Buying it: ask for" in letter
    assert "Sources" in letter and "https://" in letter
    assert "Of the plants we checked, 50% are native to Florida. With these changes, it would be" in letter
    assert "score" not in letter.lower()


def test_letter_rejects_ai_text_with_new_names(plan, rephrase):
    rephrase["reply"] = "Our campus could host the Northern mockingbird and saw palmetto."
    letter, ai_unavailable = ai_service.generate_letter(plan, ZIP)
    assert "northern mockingbird" not in letter.lower() and "saw palmetto" not in letter.lower()
    assert ai_unavailable is False


def test_letter_rejects_ai_text_that_changes_numbers(plan, rephrase):
    rephrase["reply"] = "Of the plants we checked, 90% are native to Florida."
    letter, _ = ai_service.generate_letter(plan, ZIP)
    assert "90%" not in letter


def test_letter_contains_no_names_beyond_its_input(plan, rephrase):
    rephrase["reply"] = None
    letter, _ = ai_service.generate_letter(plan, ZIP)
    assert not mentions_new_names(letter, ai_service.letter_facts(plan, ZIP))


def test_letter_uses_ai_wording_when_it_passes(plan, rephrase):
    opening = ai_service.letter_facts(plan, ZIP).split("\n\n")[1]
    rephrase["reply"] = "Hello! " + opening
    letter, _ = ai_service.generate_letter(plan, ZIP)
    assert "Hello! " in letter


def test_letter_prompt_has_plain_language_rules(plan, rephrase):
    ai_service.generate_letter(plan, ZIP)
    assert "7th-grade" in rephrase["system"]
    assert "Do not add" in rephrase["system"]


def test_letter_works_without_ai(plan, rephrase):
    rephrase["reply"] = openai_client.AIUnavailable("down")
    letter, ai_unavailable = ai_service.generate_letter(plan, ZIP)
    assert ai_unavailable is True
    assert letter == ai_service.letter_facts(plan, ZIP)


def test_letter_without_percentages_says_so(rephrase):
    empty = {"remove": [], "add": [], "gaps": [], "summary": {"percent_native": None, "percent_native_with_plan": None}}
    letter, _ = ai_service.generate_letter(empty, ZIP)
    assert "We couldn't identify enough plants to give a percentage yet." in letter
    assert "None%" not in letter
