import pytest

from services.ai_service import get_plant_recommendations
from services.plan_service import build_plan, rank_recommendations
from services.score_service import calculate_biodiversity_score


def observed(name, **extra):
    return {"scientific_name": name, "needs_confirmation": False, **extra}


PEPPER = observed("Schinus terebinthifolius")
COONTIE = observed("Zamia integrifolia")


def test_management_review_is_source_checked_and_deduplicated():
    plan = build_plan([PEPPER, PEPPER, COONTIE])
    assert len(plan["remove"]) == 1
    assert plan["remove"][0]["invasive_status"] == "invasive"
    assert plan["remove"][0]["selected"] is False
    assert "does not authorize removal" in plan["remove"][0]["action"]
    assert plan["summary"]["percent_native"] == 50
    assert plan["summary"]["percent_native_with_plan"] == 50
    assert plan["selected_additions"] == plan["selected_removals"] == []


def test_unconfirmed_invasive_does_not_become_management_target():
    plan = build_plan([observed("Schinus terebinthifolius", needs_confirmation=True, invasive_status="native")])
    assert plan["remove"] == []
    assert plan["summary"]["unresolved_count"] == 1


def test_plan_uses_explicit_selection_and_retains_invasive_without_selected_removal():
    plan = build_plan([PEPPER, COONTIE], additions=["Muhlenbergia capillaris"])
    assert plan["summary"]["percent_native_with_plan"] == 66.7
    assert plan["summary"]["counts_with_plan"]["invasive"] == 1
    assert [p["scientific_name"] for p in plan["selected_additions"]] == ["Muhlenbergia capillaris"]
    removed = build_plan([PEPPER, PEPPER, COONTIE], removals=["Schinus terebinthifolius"])
    assert removed["summary"]["percent_native_with_plan"] == 100
    assert removed["remove"][0]["selected"] is True


def test_plan_filters_site_and_excludes_existing_species():
    site = {"sun": "full", "moisture": "dry", "space": "small"}
    plan = build_plan([COONTIE], site=site)
    assert plan["add"]
    assert len(plan["add"]) <= 5
    assert all(item["scientific_name"] != "Zamia integrifolia" for item in plan["add"])
    assert all(item["site_requirements"]["min_space"] == "small" for item in plan["add"])
    assert all(item["status_verified"] and item["source_url"] for item in plan["add"])


@pytest.mark.parametrize("name,site", [("Salvia coccinea", {}), ("Schinus terebinthifolius", {}),
                                       ("Hamelia patens", {}), ("Quercus virginiana", {"space": "small"})])
def test_plan_rejects_unverified_or_unsuitable_selected_additions(name, site):
    with pytest.raises(ValueError):
        build_plan([COONTIE], additions=[name], site=site)


def test_northern_florida_keeps_inventory_and_management_without_planting_advice():
    plan = build_plan([PEPPER, COONTIE], "32301")
    assert plan["south_florida"] is False
    assert plan["add"] == [] and len(plan["remove"]) == 1
    assert plan["summary"]["percent_native"] == plan["summary"]["percent_native_with_plan"] == 50
    with pytest.raises(ValueError):
        build_plan([PEPPER], "32301", additions=["Zamia integrifolia"])


def test_ranking_describes_documentation_and_genus_counts_not_measured_site_outcomes():
    choices = get_plant_recommendations("33431")
    assert all(item["reason"] and "not a measured" in item["ranking_basis"] for item in choices)
    oak = next(item for item in choices if item["scientific_name"] == "Quercus virginiana")
    assert oak["nwf"]["caterpillar_species"] == 395
    assert "whole plant genus" in oak["nwf"]["scope"]
    assert oak["nwf"]["source"]["url"]
    assert "effect" not in oak  # No automatic percentage gain or campus wildlife count.


def test_invasive_genus_does_not_close_native_relationship_gaps():
    plan = build_plan([observed("Acacia auriculiformis")])
    assert "important_wildlife_plant" in plan["gaps"]
    assert "not measured absences" in plan["gap_note"]


def test_rank_preserves_all_filtered_options_and_deterministic_order():
    choices = get_plant_recommendations("33431")
    audit = calculate_biodiversity_score([], "33431")
    ranked = rank_recommendations(list(reversed(choices)), audit, "33431")
    assert [p["taxon_id"] for p in ranked] == [p["taxon_id"] for p in choices]
    assert len({p["taxon_id"] for p in ranked}) == len(ranked)
