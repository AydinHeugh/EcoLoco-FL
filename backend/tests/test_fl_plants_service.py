import json

import pytest
import requests

from services.fl_plants_service import DATA_DIR, bundled_catalog, bundled_natives, get_status, supported_location

ZIP = "33139"


def assert_unknown(status):
    assert status["native"] is None
    assert status["invasive"] is None
    assert status["status_verified"] is False
    assert status["needs_confirmation"] is True


def test_brazilian_pepper_is_verified_invasive_from_fisc():
    status = get_status("Schinus terebinthifolia", ZIP)
    assert status["invasive"] is True
    assert status["native"] is False
    assert status["source"] == "FISC"
    assert status["status_verified"] is True
    assert status["needs_confirmation"] is False
    assert status["fisc_category"] == "I"
    assert status["source_url"].endswith(".pdf")
    assert status["verified_on"]
    assert status["why"]


def test_coontie_is_verified_native_with_provenance():
    status = get_status("Zamia integrifolia", ZIP)
    assert status["native"] is True
    assert status["invasive"] is False
    assert status["source"] == "fl_natives"
    assert status["status_verified"] is True
    assert status["needs_confirmation"] is False
    assert status["taxon_id"]
    assert status["source_url"].startswith("https://")
    assert status["verified_on"]
    assert "Atala" in status["why"]


@pytest.mark.parametrize("name", [None, "", "   ", 123, {}, "Plantus imaginarius"])
def test_empty_malformed_and_unsupported_names_are_unknown(name):
    assert_unknown(get_status(name, ZIP))


@pytest.mark.parametrize("name", ["  schinus TEREBINTHIFOLIA  ", "Schinus\tterebinthifolia\n", "Schinus terebinthifolia Raddi"])
def test_case_whitespace_and_author_do_not_change_identity(name):
    assert get_status(name, ZIP) == get_status("Schinus terebinthifolia", ZIP)


@pytest.mark.parametrize("name, accepted", [
    ("Schinus terebinthifolius", "Schinus terebinthifolia"),
    ("Pontederia crassipes", "Eichhornia crassipes"),
    ("Zamia floridana", "Zamia integrifolia"),
    ("Lantana × strigocamara", "Lantana strigocamara"),
    ("Asclepias tuberosa subsp. rolfsii", "Asclepias tuberosa"),
    ("Asclepias tuberosa var. rolfsii", "Asclepias tuberosa"),
])
def test_documented_synonyms_share_canonical_taxon(name, accepted):
    result = get_status(name, ZIP)
    reference = get_status(accepted, ZIP)
    assert result["taxon_id"] == reference["taxon_id"]
    assert result["native"] == reference["native"]
    assert result["invasive"] == reference["invasive"]
    assert result["status_verified"] is True


@pytest.mark.parametrize("name", ["Zamia integrifolia L.", "Zamia integrifolia L. f.", "zamia integrifolia l.", "Zamia integrifolia L. f. ex Aiton"])
def test_coontie_author_suffixes_match(name):
    assert get_status(name, ZIP)["native"] is True


def test_parenthesized_authors_match():
    assert get_status("Melaleuca quinquenervia (Cav.) S.T. Blake", ZIP)["invasive"] is True


@pytest.mark.parametrize("name", [
    "Hamelia patens var. glabra", "Hamelia patens Jacq. var. glabra",
    "Hamelia patens ‘Dwarf’", "Hamelia patens 'Compacta'",
])
def test_glabra_firebush_and_documented_nursery_names_are_nonnative(name):
    status = get_status(name, ZIP)
    assert status["native"] is False
    assert status["invasive"] is False
    assert status["source"] == "fl_non_natives"
    assert status["status_verified"] is True
    assert status["needs_taxon_confirmation"] is False


@pytest.mark.parametrize("name", ["Ficus microcarpa subsp. fuyuensis", "Ficus microcarpa ssp. fuyuensis", "Ficus microcarpa var. fuyuensis"])
def test_fisc_exempt_ficus_is_not_labeled_invasive(name):
    status = get_status(name, ZIP)
    assert status["native"] is False
    assert status["invasive"] is False
    assert status["status_verified"] is True
    assert status["needs_taxon_confirmation"] is False


@pytest.mark.parametrize("name, field", [("Hamelia patens", "native"), ("Ficus microcarpa", "invasive")])
def test_coarse_taxon_retains_evidence_but_requests_meaningful_disambiguation(name, field):
    status = get_status(name, ZIP)
    assert status[field] is True
    assert status["scientific_name"] == name
    assert status["status_verified"] is True
    assert status["needs_taxon_confirmation"] is True
    assert status["needs_confirmation"] is True
    assert status["taxonomy_notes"]


def test_native_firebush_has_a_precise_confirmable_choice():
    status = get_status("Hamelia patens var. patens", ZIP)
    assert status["native"] is True
    assert status["status_verified"] is True
    assert status["needs_taxon_confirmation"] is False
    assert any(entry["scientific_name"] == "Hamelia patens var. patens" for entry in bundled_catalog())


@pytest.mark.parametrize("name", [
    "Zamia pumila", "Zamia integrifolia var. imaginaria",
    "Hamelia patens x Hamelia cuprea", "Zamia integrifolia 'Unknown cultivar'",
    "Zamia integrifolia imaginaria", "Zamia integrifolia var.",
    "Zamia integrifolia subvar. imaginaria", "Zamia integrifolia cf. florida",
    "Zamia integrifolia cv. Dwarf",
    "Zamia integrifolia Dwarf", "Ruellia simplex Purple Showers",
])
def test_distinct_taxa_do_not_inherit_a_parent_or_old_misapplied_synonym(name):
    assert_unknown(get_status(name, ZIP))


def test_tropical_sage_currently_classified_as_nonnative():
    status = get_status("Salvia coccinea", ZIP)
    assert status["native"] is False
    assert status["status_verified"] is True
    assert all(entry["scientific_name"] != "Salvia coccinea" for entry in bundled_natives())


def test_national_native_does_not_make_blanketflower_a_florida_native():
    status = get_status("Gaillardia pulchella", ZIP)
    assert status["native"] is False
    assert status["status_verified"] is True


def test_fisc_distribution_is_not_a_safe_outside_zone_rule():
    status = get_status("Albizia julibrissin", ZIP)
    assert status["known_distribution_zones"] == "N, C"
    assert status["invasive"] is True
    assert "not potential range" in status["distribution_note"]
    assert "not regulatory" in status["distribution_note"]


def test_curated_milkweed_evidence_preserves_fisc_category():
    status = get_status("Asclepias curassavica", ZIP)
    assert status["source"] == "fl_non_natives"
    assert status["native"] is False
    assert status["invasive"] is True
    assert status["fisc_category"] == "II"
    assert status["known_distribution_zones"] == "N, C, S"
    assert "not regulatory" in status["distribution_note"]
    assert status["additional_source_url"].endswith(".pdf")


@pytest.mark.parametrize("location", ["33001", "33139", "33201", "33301", "33431"])
def test_pilot_location_support(location):
    assert supported_location(location)
    assert get_status("Zamia integrifolia", location)["native"] is True


@pytest.mark.parametrize("location", ["10001", "32999", "33500", "3313", "331390", "abcde", "٣٣١٣٩", None, 33139])
def test_other_locations_are_not_misrepresented_as_supported(location):
    assert not supported_location(location)
    assert_unknown(get_status("Zamia integrifolia", location))
    assert "330–334" in get_status("Zamia integrifolia", location)["why"]


def test_status_lookup_and_catalog_never_need_a_network(monkeypatch):
    def forbidden(*args, **kwargs):
        pytest.fail("status evidence must remain available offline")
    monkeypatch.setattr(requests, "get", forbidden)
    monkeypatch.setattr(requests, "post", forbidden)
    assert get_status("Zamia integrifolia", ZIP)["native"] is True
    assert get_status("Schinus terebinthifolia", ZIP)["invasive"] is True
    assert_unknown(get_status("Plantus imaginarius", ZIP))
    assert bundled_catalog()


def test_returned_objects_do_not_mutate_cached_evidence():
    result = get_status("Zamia integrifolia", ZIP)
    result["source"] = "tampered"
    natives = bundled_natives()
    natives[0]["synonyms"].append("Plantus imaginarius")
    catalog = bundled_catalog()
    catalog[0]["source_url"] = "tampered"
    assert get_status("Zamia integrifolia", ZIP)["source"] == "fl_natives"
    assert_unknown(get_status("Plantus imaginarius", ZIP))
    assert all(entry["source_url"] != "tampered" for entry in bundled_catalog())


@pytest.mark.parametrize("filename, source", [("fisc_list.json", "FISC"), ("fl_natives.json", "fl_natives"), ("fl_non_natives.json", "fl_non_natives")])
def test_every_sourced_entry_and_synonym_resolves_offline(filename, source):
    entries = json.loads((DATA_DIR / filename).read_text(encoding="utf-8"))["species"]
    assert entries
    for entry in entries:
        for name in [entry["scientific_name"], *entry.get("synonyms", [])]:
            result = get_status(name, ZIP)
            # This sourced override adds the Extension assessment and wildlife
            # explanation while retaining its same FISC invasive classification.
            expected_source = "fl_non_natives" if name == "Asclepias curassavica" else source
            assert result["source"] == expected_source, name
            assert result["status_verified"] is True, name
            assert result["source_url"].startswith("https://"), name
            assert result["verified_on"], name


def test_catalog_has_substantial_verified_offline_coverage():
    catalog = bundled_catalog()
    assert len(catalog) >= 190
    assert sum(entry["native"] is True for entry in catalog) >= 15
    assert sum(entry["invasive"] is True for entry in catalog) >= 179
    assert all(entry["status_verified"] for entry in catalog)
    assert len({entry["taxon_id"] for entry in catalog}) == len(catalog)
