import json

import pytest

from scripts.build_fisc_list import clean_name, merge
from services.fl_plants_service import DATA_DIR


@pytest.mark.parametrize("raw, expected", [
    ("Ficus microcarpa2", ("Ficus microcarpa", [])),
    ("Salvinia molesta*", ("Salvinia molesta", [])),
    ("Pongamia (=Millettia) pinnata*", ("Pongamia pinnata", ["Millettia pinnata"])),
    ("Heptapleurum (=Schefflera) actinophylla", ("Heptapleurum actinophylla", ["Schefflera actinophylla"])),
    ("Triadica sebifera (=Sapium sebiferum)", ("Triadica sebifera", ["Sapium sebiferum"])),
    ("Pueraria montana var. lobata", ("Pueraria montana var. lobata", [])),
])
def test_clean_name(raw, expected):
    assert clean_name(raw) == expected


OFFICIAL = [
    {"scientific_name": "Schinus terebinthifolia", "common_name": "Brazilian pepper", "synonyms": [], "fisc_category": "I", "zones": "N, C, S"},
    {"scientific_name": "Psidium cattleianum", "common_name": "strawberry guava", "synonyms": [], "fisc_category": "I", "zones": "C, S"},
    {"scientific_name": "Abrus precatorius", "common_name": "rosary pea", "synonyms": [], "fisc_category": "I", "zones": "C, S"},
]
CURATED = [
    {"scientific_name": "Schinus terebinthifolia", "common_name": "Brazilian pepper", "synonyms": ["Schinus terebinthifolius"], "why": "pepper why"},
    {"scientific_name": "Psidium cattleyanum", "common_name": "Strawberry guava", "synonyms": ["Psidium cattleianum", "Psidium littorale"], "why": "guava why"},
    {"scientific_name": "Thespesia populnea", "common_name": "Seaside mahoe", "synonyms": [], "why": "mahoe why"},
]


def test_merge_keeps_curated_why_and_synonyms():
    merged, _ = merge(OFFICIAL, CURATED)
    pepper = merged[0]
    assert pepper["why"] == "pepper why"
    assert "Schinus terebinthifolius" in pepper["synonyms"]
    assert pepper["fisc_category"] == "I"


def test_merge_matches_curated_by_synonym():
    merged, _ = merge(OFFICIAL, CURATED)
    guava = merged[1]
    assert guava["scientific_name"] == "Psidium cattleianum"
    assert guava["why"] == "guava why"
    assert {"Psidium cattleyanum", "Psidium littorale"} <= set(guava["synonyms"])
    assert "Psidium cattleianum" not in guava["synonyms"]


def test_merge_sets_null_why_for_new_species():
    merged, _ = merge(OFFICIAL, CURATED)
    assert merged[2]["why"] is None


def test_merge_reports_curated_species_missing_from_official_list():
    _, unmatched = merge(OFFICIAL, CURATED)
    assert unmatched == ["Thespesia populnea"]


def test_fisc_list_is_the_full_official_list():
    data = json.loads((DATA_DIR / "fisc_list.json").read_text(encoding="utf-8"))
    species = data["species"]
    assert len(species) >= 100
    assert {s["fisc_category"] for s in species} == {"I", "II"}
    for s in species:
        assert s["scientific_name"].strip() and s["common_name"].strip()
        assert isinstance(s["synonyms"], list)
        assert s["why"] is None or s["why"].strip()
    assert sum(1 for s in species if s["why"]) >= 15
    assert any(s["scientific_name"] == "Schinus terebinthifolia" and s["why"] for s in species)
