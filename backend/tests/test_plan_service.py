import json
import re

import pytest

from services import plan_service, usda_service
from services.species_service import DATA_DIR
from services.plan_service import build_plan

ALL = json.loads((DATA_DIR / "fl_recommendations.json").read_text(encoding="utf-8"))["species"]
NWF_COUNTS = {str(g["caterpillar_species"]) for g in json.loads((DATA_DIR / "nwf_keystone_fl.json").read_text(encoding="utf-8"))["genera"]}
PEPPER = {"scientific_name": "Schinus terebinthifolius", "plant_name": "Brazilian peppertree"}


@pytest.fixture(autouse=True)
def usda(monkeypatch):
    monkeypatch.setattr(usda_service, "florida_status",
                        lambda name: "introduced" if name in {"Ixora coccinea", "Zamia furfuracea"} else None)


@pytest.fixture
def verified(monkeypatch):
    monkeypatch.setattr(plan_service, "_recommendations", lambda: [dict(e, verified=True) for e in ALL])


def test_invasive_gets_remove_card_and_replacement(verified):
    plan = build_plan([PEPPER, {"scientific_name": "Ixora coccinea"}])
    assert [c["plant_name"] for c in plan["remove"]] == ["Brazilian pepper"]
    assert "poison ivy" in plan["remove"][0]["removal_safety"]["text"]
    assert plan["add"][0]["reason"] == "replaces Brazilian pepper"
    assert plan["remove"][0]["replacement"] == plan["add"][0]["scientific_name"]


def test_remove_card_falls_back_to_generic_safety(verified):
    plan = build_plan([{"scientific_name": "Cupaniopsis anacardioides"}])
    assert plan["remove"][0]["removal_safety"] == {"text": "Ask your grounds crew how to remove it safely.", "source": None}


def test_non_native_is_never_removed(verified):
    plan = build_plan([{"scientific_name": "Ixora coccinea"}, {"scientific_name": "Zamia furfuracea"}])
    assert plan["remove"] == []


def test_duplicate_invasive_one_card(verified):
    plan = build_plan([PEPPER, dict(PEPPER, scientific_name="Brazilian pepper")])
    assert len(plan["remove"]) == 1
    assert sum(1 for a in plan["add"] if a["reason"].startswith("replaces")) == 1


def test_two_invasives_get_different_replacements(verified):
    plan = build_plan([PEPPER, {"scientific_name": "Melaleuca quinquenervia"}])
    replacements = [r["replacement"] for r in plan["remove"]]
    assert len(set(replacements)) == 2


def test_adds_only_from_our_data(verified):
    names = {e["scientific_name"] for e in ALL}
    plan = build_plan([PEPPER])
    assert plan["add"] and all(a["scientific_name"] in names for a in plan["add"])
    assert len(plan["add"]) <= 5


def test_unverified_plants_are_never_recommended():
    plan = build_plan([PEPPER])
    assert plan["add"] == []
    assert plan["remove"][0]["replacement"] is None


def test_mix_rules_on_empty_audit(verified):
    top3 = build_plan([])["add"][:3]
    assert sum(a["plant_type"] == "tree" for a in top3) <= 1
    assert any(a["effort"] == "easy" for a in top3)


def test_oak_effect_is_group_count(verified, monkeypatch):
    monkeypatch.setattr(plan_service, "_recommendations",
                        lambda: [dict(e, verified=True) for e in ALL if e["common_name"] in {"Live oak", "Coontie"}])
    effects = {a["common_name"]: a.get("effect") for a in build_plan([])["add"]}
    assert effects["Live oak"] == "Oaks feed 395 kinds of caterpillars here."


def test_effects_never_sum_counts(verified):
    for a in build_plan([PEPPER, {"scientific_name": "Melaleuca quinquenervia"}])["add"]:
        effect = a.get("effect") or ""
        numbers = re.findall(r"\d+(?!%)\b", effect.replace("%", "% "))
        assert all(n in NWF_COUNTS for n in numbers), effect


def test_effect_shows_percent_change(verified):
    plan = build_plan([PEPPER, {"scientific_name": "Zamia integrifolia"}])
    assert plan["remove"][0]["effect"] == "Replacing it takes you from 50% to 100% native."


def test_gaps_on_empty_audit(verified):
    assert set(build_plan([])["gaps"]) == {"important_wildlife_plant", "caterpillar_food", "fruit"}


def test_gaps_close_when_campus_has_them(verified):
    plan = build_plan([{"scientific_name": "Quercus virginiana"}, {"scientific_name": "Callicarpa americana"}])
    assert "important_wildlife_plant" not in plan["gaps"]
    assert "caterpillar_food" not in plan["gaps"]
    assert "fruit" not in plan["gaps"]


def test_add_card_has_where_and_reason(verified):
    add = build_plan([])["add"][0]
    assert add["where"].endswith(".")
    assert add["reason"].startswith("fills a gap: ") or add["reason"] == "another good native for your campus"


def test_summary_counts_the_plan(verified):
    plan = build_plan([PEPPER])
    assert plan["summary"]["percent_native"] == 0
    assert plan["summary"]["percent_native_with_plan"] == 100


def test_cards_carry_nwf_group_counts(verified, monkeypatch):
    monkeypatch.setattr(plan_service, "_recommendations",
                        lambda: [dict(e, verified=True) for e in ALL if e["common_name"] in {"Live oak", "Coontie"}])
    plan = build_plan([{"scientific_name": "Acacia auriculiformis"}])
    adds = {a["common_name"]: a.get("nwf") for a in plan["add"]}
    assert adds["Live oak"] == {"group": "oaks", "caterpillar_species": 395}
    assert adds["Coontie"] is None
    assert plan["remove"][0]["nwf"] == {"group": "acacias", "caterpillar_species": 29}


def test_unreplaced_invasive_does_not_count_as_native():
    plan = build_plan([PEPPER, dict(PEPPER), {"scientific_name": "Zamia integrifolia"}])
    assert plan["add"] == []
    assert plan["summary"]["percent_native"] == 33
    assert plan["summary"]["percent_native_with_plan"] == 33
    assert plan["summary"]["counts_with_plan"]["invasive"] == 2
    assert "effect" not in plan["remove"][0]


def test_replaced_invasive_counts_every_scan_of_it(verified):
    plan = build_plan([PEPPER, dict(PEPPER), {"scientific_name": "Zamia integrifolia"}])
    assert plan["remove"][0]["effect"] == "Replacing it takes you from 33% to 100% native."
    assert plan["summary"]["counts_with_plan"]["invasive"] == 0


def test_plan_looks_each_plant_up_once(verified, monkeypatch):
    from services import summary_service
    calls = []
    real = summary_service.plant_option
    monkeypatch.setattr(summary_service, "plant_option", lambda *a: calls.append(a) or real(*a))
    build_plan([PEPPER, {"scientific_name": "Ixora coccinea"}, {"scientific_name": "Zamia integrifolia"}])
    assert len(calls) == 3


def test_invasive_never_counts_as_important_wildlife_plant(verified):
    gaps = build_plan([{"scientific_name": "Acacia auriculiformis"}])["gaps"]
    assert "important_wildlife_plant" in gaps
    assert "caterpillar_food" in gaps
