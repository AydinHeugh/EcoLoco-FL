import pytest

from services import ai_service, openai_client

ZIP = "33431"


@pytest.fixture
def model(monkeypatch):
    state = {
        "species": {"scientific_name": "Zamia integrifolia", "common_name": "Coontie", "confidence": 0.93,
                    "candidates": [], "source": "plantnet", "needs_confirmation": False},
        "assessment": {"wildlife_support": "medium", "wildlife_support_reason": "Possibly feeds birds.",
                       "invasive_status": "native"},
        "assess_calls": [], "assess_error": None,
    }
    monkeypatch.setattr(ai_service, "identify_species", lambda images, location: state["species"])
    def fake_assess(species, status, location):
        state["assess_calls"].append(status)
        if state["assess_error"]:
            raise state["assess_error"]
        return state["assessment"]
    monkeypatch.setattr(ai_service, "assess_plant", fake_assess)
    return state


def test_native_fact_and_benefit_work_without_explanation_provider(model):
    model["assess_error"] = openai_client.AIUnavailable("outage")
    result = ai_service.identify_plant(["image"], ZIP)
    assert result["invasive_status"] == "native"
    assert result["status_verified"] is True
    assert result["is_native"] is True
    assert result["wildlife_support"] == "documented"
    assert "Atala" in result["wildlife_support_reason"]
    assert result["wildlife_support_verified"] is True
    assert result["needs_confirmation"] is False
    assert model["assess_calls"] == []
    assert result["source_url"] and result["verified_on"]


def test_verified_invasive_retains_sources_and_reviewed_management(model):
    model["species"].update(scientific_name="Schinus terebinthifolia", common_name="Brazilian pepper")
    result = ai_service.identify_plant(["image"], ZIP)
    assert result["invasive_status"] == "invasive"
    assert result["source"] == "FISC"
    assert result["is_native"] is False
    assert result["fisc_category"]
    assert result["actions"][0]["action"] == "Do not plant or propagate this species"
    assert "before any removal" in result["actions"][1]["action"]


def test_uncertain_invasive_is_not_given_removal_action(model):
    model["species"].update(scientific_name="Schinus terebinthifolia", needs_confirmation=True, confidence=0.99)
    result = ai_service.identify_plant(["image"], ZIP)
    assert result["status_verified"] is True
    assert result["needs_confirmation"] is True
    assert result["actions"][0]["action"].startswith("Confirm")
    assert "consider removing" not in str(result["actions"]).lower()


def test_unknown_status_suggestion_is_visible_but_not_a_verified_fact(model):
    model["species"].update(scientific_name="Plantus imaginarius")
    model["assessment"].update(invasive_status=" Invasive ", is_native="false", wildlife_support="HIGH")
    result = ai_service.identify_plant(["image"], ZIP)
    assert result["invasive_status"] == "unknown"
    assert result["is_native"] is None
    assert result["status_verified"] is False
    assert result["suggested_status"] == "invasive"
    assert result["suggested_wildlife_support"] == "high"
    assert result["wildlife_support"] == "unknown"
    assert "excluded" in result["suggestion_note"]
    assert "removal" not in result["actions"][0]["action"]


def test_no_identification_never_gains_ecological_claims(model):
    model["species"].update(scientific_name="", common_name="", source="none", needs_confirmation=True, confidence=0)
    result = ai_service.identify_plant(["image"], ZIP)
    assert result["plant_name"] == "Unidentified plant"
    assert result["invasive_status"] == result["wildlife_support"] == "unknown"
    assert result["ai_unavailable"] is True
    assert model["assess_calls"] == []


def test_unknown_outage_preserves_unknown_fields(model):
    model["species"].update(scientific_name="Plantus imaginarius")
    model["assess_error"] = openai_client.AIUnavailable("outage")
    result = ai_service.identify_plant(["image"], ZIP)
    assert result["ai_unavailable"] is True
    assert result["invasive_status"] == result["wildlife_support"] == "unknown"


def test_assessor_rejects_non_object_and_does_not_call_taxon_photo_verified(monkeypatch):
    sent = []
    monkeypatch.setattr(openai_client, "chat", lambda prompt, **kwargs: sent.append(prompt) or [])
    with pytest.raises(openai_client.AIUnavailable):
        ai_service.assess_plant({"scientific_name": "Zamia integrifolia"},
            {"native": True, "invasive": False, "source": "fl_natives", "status_verified": True}, ZIP)
    assert "not the photo identification" in sent[0]


def test_manual_confirmation_refreshes_taxonomy_without_fabricated_confidence():
    result = ai_service.confirm_plant("Zamia floridana", ZIP)
    assert result["scientific_name"] == "Zamia integrifolia"
    assert result["status_verified"] is True
    assert result["user_confirmed"] is True
    assert result["needs_confirmation"] is False
    assert result["confidence"] is None
    assert result["id_source"] == "manual_confirmation"


def test_coarse_firebush_confirmation_requires_precise_variety():
    coarse = ai_service.confirm_plant("Hamelia patens", ZIP)
    assert coarse["needs_taxon_confirmation"] and coarse["needs_confirmation"]
    assert {entry["scientific_name"] for entry in coarse["candidates"]} >= {"Hamelia patens var. patens", "Hamelia patens var. glabra"}
    assert all(entry["confidence"] is None for entry in coarse["candidates"])
    native = ai_service.confirm_plant("Hamelia patens var. patens", ZIP)
    introduced = ai_service.confirm_plant("Hamelia patens var. glabra", ZIP)
    assert native["is_native"] is True and not native["needs_confirmation"]
    assert introduced["is_native"] is False and not introduced["needs_confirmation"]


def test_catalog_is_deduplicated_and_contains_sourced_native_and_nonnative_choices():
    entries = ai_service.get_catalog(ZIP)
    assert len(entries) > 100
    assert len({entry["taxon_id"] for entry in entries}) == len(entries)
    assert all(entry["status_verified"] and entry["source_url"] for entry in entries)
    assert {entry["invasive_status"] for entry in entries} == {"native", "non-native", "invasive"}
    assert all(not entry["user_confirmed"] for entry in entries)


def test_recommendations_have_complete_schema_without_model_calls(monkeypatch):
    monkeypatch.setattr(openai_client, "chat", lambda *args, **kwargs: pytest.fail("recommendations must not need a model"))
    results = ai_service.get_plant_recommendations(ZIP)
    assert len(results) >= 10
    fields = {"plant_name", "scientific_name", "taxon_id", "why", "source_url", "verified_on", "problem",
              "action", "impact", "benefit", "suitability", "site_requirements", "why_source_url"}
    assert all(fields <= item.keys() and item["status_verified"] for item in results)
    assert all(item["site_needs_confirmation"] for item in results)
    assert all(item["wildlife_support"] == "documented" for item in results)
    assert ai_service.fallback_recommendations(ZIP) == results


def test_recommendations_use_site_and_observed_inventory():
    site = {"sun": "full", "moisture": "dry", "space": "small", "maintenance": "unknown"}
    choices = ai_service.get_plant_recommendations(ZIP, site=site)
    assert choices
    assert all("full" in item["site_requirements"]["sun"] and "dry" in item["site_requirements"]["moisture"] for item in choices)
    assert all(item["site_requirements"]["min_space"] == "small" for item in choices)
    observed = {"scientific_name": choices[0]["scientific_name"], "needs_confirmation": False}
    changed = ai_service.get_plant_recommendations(ZIP, plants=[observed], site=site)
    assert observed["scientific_name"] not in {item["scientific_name"] for item in changed}
    shade = ai_service.get_plant_recommendations(ZIP, site={"sun": "shade", "moisture": "average", "space": "small"})
    assert shade and {item["scientific_name"] for item in choices} != {item["scientific_name"] for item in shade}


def test_recommendations_never_add_unsupported_imaginary_or_invasive_entries(monkeypatch):
    original = ai_service.bundled_natives()
    malicious = [
        {**original[0], "scientific_name": "Plantus imaginarius"},
        {**original[0], "scientific_name": "Schinus terebinthifolia"},
        {**original[0], "scientific_name": "Salvia coccinea"},
    ]
    monkeypatch.setattr(ai_service, "bundled_natives", lambda: malicious)
    assert ai_service.get_plant_recommendations(ZIP) == []


def test_known_complete_site_does_not_claim_missing_conditions():
    choices = ai_service.get_plant_recommendations(ZIP, site={"sun": "full", "moisture": "dry", "space": "large", "maintenance": "low"})
    assert choices
    assert all(not item["site_needs_confirmation"] for item in choices)
    assert all(item["site_requirements"]["maintenance"] == "low" for item in choices)
    assert all("planning filters" in item["suitability"] for item in choices)


def test_proposal_uses_recorded_facts_selected_taxa_sources_and_practical_fields(monkeypatch):
    monkeypatch.setattr(openai_client, "chat", lambda *args, **kwargs: pytest.fail("proposal must not need a model"))
    result = ai_service.generate_proposal({
        "plant_names": ["Quercus virginiana"], "zip_code": ZIP, "score": 99,
        "plants": [{"scientific_name": "Zamia integrifolia", "needs_confirmation": False},
                   {"scientific_name": "Schinus terebinthifolia", "user_confirmed": True},
                   {"plant_name": "Unidentified shrub"}],
        "survey_date": "2026-10-17", "site_name": "West courtyard",
        "proposal": {"school_name": "Example School", "student_name": "Student", "principal_name": "Principal",
                     "location": "Courtyard edge", "quantity": "One live oak", "budget": "$75, to be confirmed", "maintenance": "Eco-club, weekly checks"},
    })
    assert "1 of 2" in result and "2 of 3" in result
    assert "West courtyard" in result and "2026-10-17" in result
    assert "One live oak" in result and "$75" in result and "Eco-club" in result
    assert "Unidentified shrub" in result
    assert "https://" in result
    assert "99" not in result and "out of 100" not in result and "poor" not in result
    assert "no improvement has been measured yet" in result
    assert "not a prediction of wildlife outcomes" in result


@pytest.mark.parametrize("name", ["Brazilian pepper", "Schinus terebinthifolia", "Plantus imaginarius", "Salvia coccinea", "Hamelia patens"])
def test_proposal_rejects_unverified_invasive_or_imprecise_selections(name):
    with pytest.raises(ValueError):
        ai_service.generate_proposal({"plant_names": [name], "zip_code": ZIP})


def test_proposal_rejects_site_conflict():
    with pytest.raises(ValueError):
        ai_service.generate_proposal({"plant_names": ["Quercus virginiana"], "zip_code": ZIP,
            "site": {"space": "small"}})


def test_duplicate_native_selection_is_printed_once_and_legacy_score_ignored():
    letter = ai_service.generate_letter(["Zamia integrifolia", "Zamia floridana"], 42, ZIP)
    assert letter.count("- Coontie (") == 1
    assert "42 out of 100" not in letter
    assert "Recorded observations: 0" in letter


def test_sample_proposal_is_unmistakably_labeled():
    letter = ai_service.generate_proposal({"plant_names": ["Zamia integrifolia"], "zip_code": ZIP, "is_sample": True})
    assert letter.startswith("SAMPLE PROPOSAL")
    assert "not a real campus survey" in letter
