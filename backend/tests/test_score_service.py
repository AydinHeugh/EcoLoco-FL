"""Species-metric invariants, using real bundled evidence and no provider calls."""

import pytest

from services.score_service import calculate_biodiversity_score

ZIP = "33431"


def observation(name, **extra):
    return {"scientific_name": name, "needs_confirmation": False, **extra}


def test_empty_or_unknown_inventory_has_no_artificial_rating():
    for plants in ([], [{"plant_name": "Unknown", "invasive_status": "native"}]):
        result = calculate_biodiversity_score(plants, ZIP)
        assert result["native_share"] is None
        assert result["verified_species_count"] == 0
        assert result["projected"]["native_share"] is None
        assert "score" not in result
        assert "Outstanding" not in result["summary"]


def test_name_case_synonyms_and_duplicate_photos_leave_share_unchanged():
    original = [observation("Zamia integrifolia", plant_name="Coontie"), observation("Schinus terebinthifolia")]
    result = calculate_biodiversity_score(original, ZIP)
    variants = [
        observation("ZAMIA INTEGRIFOLIA", plant_name="TOTALLY DIFFERENT DISPLAY"),
        observation("Zamia floridana"), observation("Schinus terebinthifolius"),
    ] * 5
    changed = calculate_biodiversity_score(variants, ZIP)
    for key in ("native_share", "native_count", "non_native_count", "invasive_count", "verified_species_count"):
        assert changed[key] == result[key]
    assert result["native_share"] == 50
    assert changed["observation_count"] == 15
    assert changed["verified_species_count"] == 2


def test_source_lookup_overrides_client_claims():
    plants = [observation("Schinus terebinthifolia", invasive_status="native", status_verified=True),
              observation("Plantus imaginarius", invasive_status="native", status_verified=True)]
    result = calculate_biodiversity_score(plants, ZIP)
    assert result["native_count"] == 0
    assert result["invasive_count"] == 1
    assert result["unresolved_count"] == 1
    assert result["native_share"] == 0


def test_unconfirmed_identification_stays_outside_denominator():
    result = calculate_biodiversity_score([
        observation("Zamia integrifolia", needs_confirmation=True, confidence=0.99),
        observation("Schinus terebinthifolia"),
    ], ZIP)
    assert result["verified_species_count"] == 1
    assert result["unresolved_count"] == 1
    assert result["native_share"] == 0
    confirmed = calculate_biodiversity_score([
        observation("Zamia integrifolia", needs_confirmation=True, user_confirmed=True)
    ], ZIP)
    assert confirmed["native_share"] == 100


def test_missing_identification_decision_does_not_count_as_confirmed():
    result = calculate_biodiversity_score([{"scientific_name": "Zamia integrifolia"}], ZIP)
    assert result["unresolved_count"] == 1


def test_coarse_firebush_stays_unresolved_even_after_coarse_confirmation():
    result = calculate_biodiversity_score([
        observation("Hamelia patens", user_confirmed=True),
        observation("Hamelia patens var. patens", user_confirmed=True),
        observation("Hamelia patens var. glabra", user_confirmed=True),
    ], ZIP)
    assert result["verified_species_count"] == 2
    assert result["unresolved_count"] == 1
    assert result["native_count"] == result["non_native_count"] == 1


def test_status_categories_partition_verified_taxa():
    result = calculate_biodiversity_score([
        observation("Zamia integrifolia"), observation("Salvia coccinea"),
        observation("Schinus terebinthifolia"),
    ], ZIP)
    assert result["verified_species_count"] == 3
    assert result["native_count"] == result["non_native_count"] == result["invasive_count"] == 1
    assert result["native_share"] == 33.3


def test_real_additions_removals_equal_recalculation():
    plants = [observation("Zamia integrifolia"), observation("Schinus terebinthifolia"),
              observation("Schinus terebinthifolia"), observation("Unknown unknown")]
    projected = calculate_biodiversity_score(plants, ZIP,
        additions=["Quercus virginiana", "Quercus virginiana"],
        removals=["Schinus terebinthifolia", "Schinus terebinthifolius"])["projected"]
    realized = calculate_biodiversity_score([
        observation("Zamia integrifolia"), observation("Unknown unknown"), observation("Quercus virginiana")], ZIP)
    for key in ("native_share", "native_count", "invasive_count", "verified_species_count", "observation_count", "unresolved_count"):
        assert projected[key] == realized[key]
    assert len(projected["added_species"]) == len(projected["removed_species"]) == 1


def test_existing_species_addition_has_no_change():
    result = calculate_biodiversity_score([observation("Zamia integrifolia")], ZIP, additions=["Zamia floridana"])
    assert result["projected"]["added_species"] == []
    assert result["projected"]["native_share"] == result["native_share"]


@pytest.mark.parametrize("addition", ["Plantus imaginarius", "Schinus terebinthifolia", "Hamelia patens", "Salvia coccinea"])
def test_invalid_planned_additions_are_rejected(addition):
    with pytest.raises(ValueError, match="verified Florida native"):
        calculate_biodiversity_score([], ZIP, additions=[addition])


def test_unrecorded_removal_or_conflicting_changes_are_rejected():
    with pytest.raises(ValueError, match="not a verified taxon"):
        calculate_biodiversity_score([], ZIP, removals=["Schinus terebinthifolia"])
    with pytest.raises(ValueError, match="both added and removed"):
        calculate_biodiversity_score([observation("Zamia integrifolia")], ZIP,
            additions=["Zamia floridana"], removals=["Zamia integrifolia"])


def test_wildlife_explanation_availability_cannot_change_metric():
    available = calculate_biodiversity_score([observation("Zamia integrifolia", wildlife_support="high")], ZIP)
    unavailable = calculate_biodiversity_score([observation("Zamia integrifolia", wildlife_support="unknown", ai_unavailable=True)], ZIP)
    assert available == unavailable
