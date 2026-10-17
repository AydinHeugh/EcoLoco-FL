import json

import pytest
import requests

from services import usda_service
from services.fl_plants_service import DATA_DIR, get_status

ZIP = "33139"
UNKNOWN = {"native": None, "invasive": None, "source": "unknown", "why": None}


def test_brazilian_pepper_is_invasive_from_fisc():
    status = get_status("Schinus terebinthifolia", ZIP)
    assert status["invasive"] is True
    assert status["native"] is False
    assert status["source"] == "FISC"
    assert status["why"]


def test_coontie_is_native_from_fl_natives():
    status = get_status("Zamia integrifolia", ZIP)
    assert status["native"] is True
    assert status["invasive"] is False
    assert status["source"] == "fl_natives"
    assert "Atala" in status["why"]


def test_made_up_name_is_unknown():
    assert get_status("Plantus imaginarius", ZIP) == UNKNOWN


@pytest.mark.parametrize("name", ["  schinus TEREBINTHIFOLIA  ", "Schinus\tterebinthifolia\n"])
def test_match_ignores_case_and_whitespace(name):
    assert get_status(name, ZIP)["source"] == "FISC"


@pytest.mark.parametrize("name, source", [
    ("Schinus terebinthifolius", "FISC"),
    ("Eichhornia crassipes", "FISC"),
    ("Pontederia crassipes", "FISC"),
    ("Zamia pumila", "fl_natives"),
])
def test_synonyms_match(name, source):
    assert get_status(name, ZIP)["source"] == source


@pytest.mark.parametrize("name, source", [
    ("Zamia integrifolia L.", "fl_natives"),
    ("Asclepias tuberosa subsp. rolfsii", "fl_natives"),
    ("Melaleuca quinquenervia (Cav.) S.T. Blake", "FISC"),
])
def test_author_or_subspecies_suffix_matches(name, source):
    assert get_status(name, ZIP)["source"] == source


@pytest.mark.parametrize("name", [None, "", "   "])
def test_empty_name_is_unknown(name):
    assert get_status(name, ZIP) == UNKNOWN


def test_returns_a_fresh_dict_each_time():
    get_status("Plantus imaginarius", ZIP)["source"] = "tampered"
    assert get_status("Plantus imaginarius", ZIP)["source"] == "unknown"


def _species(filename):
    return json.loads((DATA_DIR / filename).read_text(encoding="utf-8"))["species"]


def _all_names(filename):
    return {n.lower() for e in _species(filename) for n in [e["scientific_name"], *e.get("synonyms", [])]}


@pytest.mark.parametrize("filename", ["fisc_list.json", "fl_natives.json"])
def test_data_file_has_20_complete_entries(filename):
    species = _species(filename)
    assert len(species) >= 20
    for entry in species:
        assert entry["scientific_name"].strip()
        assert entry["common_name"].strip()
        if filename == "fl_natives.json":
            assert entry["why"].strip()
    assert sum(1 for entry in species if entry["why"]) >= 15


def test_no_species_is_on_both_lists():
    assert not _all_names("fisc_list.json") & _all_names("fl_natives.json")


@pytest.mark.parametrize("filename, source", [("fisc_list.json", "FISC"), ("fl_natives.json", "fl_natives")])
def test_every_entry_resolves_to_its_own_list(filename, source):
    for entry in _species(filename):
        assert get_status(entry["scientific_name"], ZIP)["source"] == source, entry["scientific_name"]


def _usda_says(monkeypatch, answer):
    def fake(name):
        if isinstance(answer, Exception):
            raise answer
        return answer
    monkeypatch.setattr(usda_service, "florida_status", fake)


def test_bundled_lists_win_over_usda(monkeypatch):
    _usda_says(monkeypatch, AssertionError("USDA should not be asked"))
    assert get_status("Zamia integrifolia", ZIP)["source"] == "fl_natives"
    assert get_status("Schinus terebinthifolia", ZIP)["source"] == "FISC"


def test_usda_native_status(monkeypatch):
    _usda_says(monkeypatch, "native")
    assert get_status("Hamelia cuprea", ZIP) == {"native": True, "invasive": False, "source": "USDA", "why": None}


def test_usda_non_native_status(monkeypatch):
    _usda_says(monkeypatch, "introduced")
    assert get_status("Ficus benjamina", ZIP) == {"native": False, "invasive": False, "source": "USDA", "why": None}


def test_usda_unknown_plant(monkeypatch):
    _usda_says(monkeypatch, None)
    assert get_status("Plantus imaginarius", ZIP) == UNKNOWN


def test_usda_error_is_unknown_and_not_cached(monkeypatch):
    monkeypatch.setattr(usda_service, "_cache", {})

    def down(*args, **kwargs):
        raise requests.ConnectionError("USDA down")

    monkeypatch.setattr(requests, "get", down)
    assert get_status("Ficus benjamina", ZIP) == UNKNOWN

    class Ok:
        def __init__(self, body):
            self.body = body
        def raise_for_status(self):
            pass
        def json(self):
            return self.body

    monkeypatch.setattr(requests, "get", lambda url, params=None, **kw: Ok(
        [{"Plant": {"Id": 9, "Symbol": "FIBE", "ScientificName": "<i>Ficus benjamina</i> L."}}] if url.endswith("/PlantSearch")
        else {"Id": 9, "Symbol": "FIBE", "NativeStatuses": [{"Region": "L48", "Status": "I"}]}))
    assert get_status("Ficus benjamina", ZIP)["source"] == "USDA"
