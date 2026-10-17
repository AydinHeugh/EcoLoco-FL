"""Guard the evidence and usable planting coverage of the bundled pilot catalog."""

import json
from datetime import date
from pathlib import Path
from urllib.parse import urlparse

import pytest


DATA = Path(__file__).resolve().parents[1] / "data"
NATIVES = json.loads((DATA / "fl_natives.json").read_text())["species"]
NONNATIVES = json.loads((DATA / "fl_non_natives.json").read_text())["species"]
BY_NAME = {row["scientific_name"]: row for row in NATIVES + NONNATIVES}


@pytest.mark.parametrize("row", NATIVES + NONNATIVES, ids=lambda row: row["scientific_name"])
def test_classification_has_traceable_evidence(row):
    assert isinstance(row["native"], bool)
    assert isinstance(row["invasive"], bool)
    assert row["taxon_id"] and row["common_name"]
    assert row["why"]
    assert date.fromisoformat(row["verified_on"])
    for key in ("source_url", "why_source_url"):
        parsed = urlparse(row[key])
        assert parsed.scheme == "https" and parsed.netloc
    # A documented benefit needs a citation and an explanation of its scope.
    assert row["wildlife_support"] in {"documented", "unknown"}
    assert row["wildlife_support_basis"]


def test_no_ambiguous_alias_can_silently_overwrite_another_classification():
    names = {}
    for row in NATIVES + NONNATIVES:
        for name in [row["scientific_name"], *row["synonyms"]]:
            normalized = " ".join(name.lower().split())
            assert normalized not in names, f"{name} also maps to {names.get(normalized)}"
            names[normalized] = row["scientific_name"]
    # Historical usage differs from the modern Caribbean species in Kew.
    assert "zamia pumila" not in names


def test_every_recommendable_plant_has_sourced_conditions_and_documented_benefit():
    recommended = [row for row in NATIVES + NONNATIVES if row["recommendable"]]
    assert len(recommended) >= 15
    for row in recommended:
        assert row["native"] is True and row["invasive"] is False
        assert row["sun"] and set(row["sun"]) <= {"full", "part", "shade"}
        assert row["moisture"] and set(row["moisture"]) <= {"dry", "average", "wet"}
        assert row["min_space"] in {"small", "medium", "large"}
        assert row["maintenance"] in {"low", "moderate"}
        assert row["requirements_source_url"].startswith("https://")
        assert row["suitability_notes"]
        assert row["wildlife_support"] == "documented"


@pytest.mark.parametrize("sun,moisture", [("full", "dry"), ("shade", "average"), ("full", "wet")])
def test_small_sites_have_real_options_in_different_habitats(sun, moisture):
    assert any(
        row["recommendable"] and row["min_space"] == "small"
        and sun in row["sun"] and moisture in row["moisture"]
        for row in NATIVES
    )


def test_wet_and_dry_milkweeds_are_not_interchangeable():
    assert "wet" in BY_NAME["Asclepias incarnata"]["moisture"]
    assert "dry" not in BY_NAME["Asclepias incarnata"]["moisture"]
    assert "wet" not in BY_NAME["Asclepias tuberosa"]["moisture"]
    assert BY_NAME["Asclepias curassavica"]["invasive"] is True
    assert BY_NAME["Asclepias curassavica"]["recommendable"] is False


def test_specialist_mangrove_is_classified_but_not_recommended_for_school_beds():
    row = BY_NAME["Rhizophora mangle"]
    assert row["native"] is True
    assert row["recommendable"] is False
    assert "shoreline" in row["suitability_notes"]


def test_consequential_taxonomic_exceptions_remain_separate():
    assert BY_NAME["Hamelia patens var. patens"]["native"] is True
    assert BY_NAME["Hamelia patens var. glabra"]["native"] is False
    ficus = BY_NAME["Ficus microcarpa subsp. fuyuensis"]
    assert ficus["native"] is False and ficus["invasive"] is False
    assert "Ficus microcarpa" not in ficus["synonyms"]
    assert ficus["taxonomy_source_url"]


def test_recent_reclassifications_are_countable_nonnatives_without_removal_claims():
    for name in ("Salvia coccinea", "Bidens alba", "Gaillardia pulchella"):
        row = BY_NAME[name]
        assert row["native"] is False and row["invasive"] is False
        assert row["wildlife_support"] == "documented"
        assert row["recommendable"] is False
    assert "Moderate Risk" in BY_NAME["Ixora coccinea"]["invasion_assessment"]
