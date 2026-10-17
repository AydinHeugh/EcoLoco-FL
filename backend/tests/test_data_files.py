import json
import re

import pytest

from scripts.build_fisc_list import merge
from services.species_service import DATA_DIR, resolve


def _load(name):
    return json.loads((DATA_DIR / name).read_text(encoding="utf-8"))


RECS = _load("fl_recommendations.json")["species"]
NWF = _load("nwf_keystone_fl.json")
FISC = {e["scientific_name"]: e for e in _load("fisc_list.json")["species"]}

PALM_BEACH_PROHIBITED = [
    "Melaleuca quinquenervia", "Schinus terebinthifolia", "Casuarina equisetifolia", "Acacia auriculiformis",
    "Pueraria montana var. lobata", "Lygodium microphyllum", "Dioscorea bulbifera", "Cupaniopsis anacardioides",
    "Heptapleurum actinophyllum",
]
BANNED = ["pruning", "host plant", "keystone", "lepidoptera", "cultivar", "established", "category i"]
PLANT_TYPES = {"tree", "shrub", "groundcover", "wildflower", "grass", "vine"}
OFFERS = {"caterpillar food", "nectar", "fruit", "shelter"}


def _sourced(fact):
    return isinstance(fact, dict) and fact.get("text") and fact.get("source", {}).get("name") and fact["source"].get("url", "").startswith("https://")


def _nulls(value, path="entry"):
    if value is None:
        yield path
    elif isinstance(value, dict):
        for k, v in value.items():
            yield from _nulls(v, f"{path}.{k}")
    elif isinstance(value, list):
        for i, v in enumerate(value):
            yield from _nulls(v, f"{path}[{i}]")


def _user_text(entry, with_buying=False):
    parts = [entry.get("helps", {}).get("text", ""), entry.get("sun", ""), entry.get("mature_size", "")]
    parts += [w["text"] for w in entry.get("watch_out", [])] + entry.get("look_into", [])
    parts += [r["why"] for r in entry.get("replaces", [])]
    if with_buying:
        parts.append(entry.get("buying", {}).get("avoid", ""))
    return " ".join(parts)


def test_about_thirty_entries():
    assert 28 <= len(RECS) <= 36


@pytest.mark.parametrize("entry", RECS, ids=lambda e: e["common_name"])
def test_every_fact_has_a_source(entry):
    assert entry["growing_source"]["url"].startswith("https://")
    assert _sourced(entry["helps"])
    if "buying" in entry and "avoid" in entry["buying"]:
        assert entry["buying"]["source"]["url"].startswith("https://")
    assert all(_sourced(w) for w in entry.get("watch_out", []))


@pytest.mark.parametrize("entry", RECS, ids=lambda e: e["common_name"])
def test_limits_and_allowed_values(entry):
    assert len(entry.get("watch_out", [])) <= 2
    assert len(entry.get("look_into", [])) <= 2
    assert entry["effort"] in {"easy", "medium", "big"}
    assert entry["plant_type"] in PLANT_TYPES
    assert set(entry.get("offers", [])) <= OFFERS
    months = entry.get("bloom_months", [])
    assert months == sorted(set(months)) and all(1 <= m <= 12 for m in months)
    assert entry["buying"]["ask_for"].startswith(entry["scientific_name"])
    assert entry["genus"] == entry["scientific_name"].split()[0]


@pytest.mark.parametrize("entry", RECS, ids=lambda e: e["common_name"])
def test_every_entry_has_verified_flag(entry):
    assert entry["verified"] is False


@pytest.mark.parametrize("entry", RECS, ids=lambda e: e["common_name"])
def test_no_null_fields(entry):
    assert list(_nulls(entry)) == []


@pytest.mark.parametrize("entry", RECS, ids=lambda e: e["common_name"])
def test_recommendations_resolve(entry):
    assert resolve(entry["scientific_name"]) == entry["scientific_name"]
    assert resolve(entry["common_name"]) == entry["scientific_name"]


@pytest.mark.parametrize("entry", RECS, ids=lambda e: e["common_name"])
def test_plain_language_and_no_scientific_names(entry):
    assert [w for w in BANNED if w in _user_text(entry, with_buying=True).lower()] == []
    assert entry["scientific_name"].lower() not in _user_text(entry).lower()


@pytest.mark.parametrize("entry", RECS, ids=lambda e: e["common_name"])
def test_replacements_point_at_fisc_invasives(entry):
    for r in entry.get("replaces", []):
        assert resolve(r["scientific_name"]) in FISC, r["scientific_name"]
        assert r["why"]


@pytest.mark.parametrize("invasive", PALM_BEACH_PROHIBITED)
def test_every_palm_beach_prohibited_invasive_has_a_replacement(invasive):
    assert invasive in FISC
    assert any(resolve(r["scientific_name"]) == invasive for e in RECS for r in e.get("replaces", []))


def test_brazilian_pepper_removal_safety_is_sourced():
    safety = FISC["Schinus terebinthifolia"]["removal_safety"]
    assert "poison ivy" in safety["text"]
    assert safety["source"]["url"].startswith("https://")


def test_nwf_values_match_pdf():
    by_genus = {g["genus"]: g for g in NWF["genera"]}
    assert by_genus["Quercus"]["caterpillar_species"] == 395
    assert by_genus["Quercus"]["group"] == "oaks"
    assert by_genus["Prunus"]["caterpillar_species"] == 247
    assert by_genus["Salix"]["caterpillar_species"] == 190
    assert len(NWF["genera"]) == 30
    assert NWF["source"]["url"].startswith("https://www.nwf.org/")


def test_merge_keeps_removal_safety():
    official = [{"scientific_name": "Schinus terebinthifolia", "common_name": "Brazilian pepper", "synonyms": [],
                 "fisc_category": "I", "zones": "N, C, S"}]
    curated = [{"scientific_name": "Schinus terebinthifolia", "synonyms": [], "why": "w",
                "removal_safety": {"text": "t", "source": {"name": "n", "url": "https://x"}}}]
    merged, _ = merge(official, curated)
    assert merged[0]["removal_safety"]["text"] == "t"


def test_merge_leaves_removal_safety_out_when_not_curated():
    official = [{"scientific_name": "Acacia auriculiformis", "common_name": "earleaf acacia", "synonyms": [],
                 "fisc_category": "I", "zones": "C, S"}]
    merged, _ = merge(official, [])
    assert "removal_safety" not in merged[0]


WHY = _load("why_this_matters.json")["lines"]


def test_why_this_matters_is_short_and_sourced():
    assert 1 <= len(WHY) <= 4
    assert all(_sourced(line) for line in WHY)
    assert all(not [w for w in BANNED if w in line["text"].lower()] for line in WHY)
