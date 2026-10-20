import json

import pytest
import requests

from services import usda_service
from services.fl_plants_service import DATA_DIR, get_status, plant_option

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


def test_usda_failure_on_option_is_unknown_not_non_native(monkeypatch):
    def down(name):
        raise requests.ConnectionError("down")

    monkeypatch.setattr(usda_service, "florida_status", down)
    option = plant_option("Ixora coccinea", "", 0.44, "33496")
    assert option["status"] == "unknown"
    assert option["status_label"] == "Unknown: not on Florida lists"
    assert option["source_label"] is None


def test_option_name_falls_back_when_common_name_blank(monkeypatch):
    monkeypatch.setattr(usda_service, "florida_status", lambda name: None)
    assert plant_option("Zamia pumila", "", 0.12, "33496")["plant_name"] == "Coontie"
    assert plant_option("Zamia loddigesii", "", 0.29, "33496")["plant_name"] == "Zamia loddigesii"


def test_option_uses_canonical_name_and_list_labels():
    option = plant_option("Schinus terebinthifolius", "Brazilian peppertree", 0.73, "33496")
    assert option == {
        "plant_name": "Brazilian pepper", "scientific_name": "Schinus terebinthifolia", "confidence": 0.73,
        "status": "invasive", "status_label": "Invasive", "source": "FISC",
        "source_label": "Florida Invasive Species Council 2026 list", "why": option["why"],
        "removal_safety": option["removal_safety"], "photo": option["photo"],
    }
    assert option["photo"]["url"].startswith("https://")
    assert option["why"]
    assert "poison ivy" in option["removal_safety"]["text"]


def test_non_native_gets_plain_why(monkeypatch):
    monkeypatch.setattr(usda_service, "florida_status", lambda name: "introduced")
    option = plant_option("Ixora coccinea", "Ixora", 0.44, "33496")
    assert option["status_label"] == "Non-native"
    assert option["source_label"] == "USDA PLANTS database"
    assert option["why"] == "Not from Florida, and not on Florida's invasive list."


def test_option_prefers_our_common_name():
    assert plant_option("Zamia integrifolia", "Florida Arrowroot", 0.25, "33496")["plant_name"] == "Coontie"


def test_option_name_starts_with_a_capital():
    assert plant_option("Melaleuca quinquenervia", "", 0.5, "33496")["plant_name"] == "Punktree"


def test_verified_plant_carries_its_atlas_link():
    assert plant_option("Zamia integrifolia", "", 0.9, ZIP)["atlas_url"] == "https://florida.plantatlas.usf.edu/plant/species/2105"


def test_unverified_plant_has_no_atlas_link(monkeypatch):
    from services import fl_plants_service
    entry = dict(fl_plants_service._by_name("fl_recommendations.json")["Zamia integrifolia"], verified=False)
    monkeypatch.setattr(fl_plants_service, "_by_name",
                        lambda name: {"Zamia integrifolia": entry} if name == "fl_recommendations.json" else {})
    assert "atlas_url" not in plant_option("Zamia integrifolia", "", 0.9, ZIP)


def test_invasive_has_no_atlas_link():
    assert "atlas_url" not in plant_option("Schinus terebinthifolia", "", 0.9, ZIP)


@pytest.mark.parametrize("name", ["Salvia coccinea", "Tropical sage", "Scarlet sage"])
def test_tropical_sage_is_non_native_per_the_atlas(monkeypatch, name):
    _usda_says(monkeypatch, AssertionError("USDA should not be asked"))
    option = plant_option(name, "", 0.9, ZIP)
    assert option["status"] == "non-native"
    assert option["source_label"] == "USF Atlas of Florida Plants"
    assert "helps" not in option and "atlas_url" not in option


def test_non_natives_are_not_on_the_other_lists():
    non_natives = _all_names("fl_non_natives.json")
    assert non_natives
    assert not non_natives & (_all_names("fl_natives.json") | _all_names("fisc_list.json") | _all_names("fl_recommendations.json"))
    for entry in _species("fl_non_natives.json"):
        assert entry["why"] and entry["source"]["url"].startswith("https://florida.plantatlas.usf.edu/plant/species/")


def test_asparagus_fern_as_plantnet_names_it_is_fisc_invasive(monkeypatch):
    _usda_says(monkeypatch, AssertionError("USDA should not be asked"))
    option = plant_option("Asparagus densiflorus", "Asparagus fern", 0.58, ZIP)
    assert option["scientific_name"] == "Asparagus aethiopicus"
    assert option["status"] == "invasive"
    assert option["source"] == "FISC"


@pytest.mark.parametrize("name, fisc", [
    ("Asparagus densiflorus", "Asparagus aethiopicus"),
    ("Asparagus sprengeri", "Asparagus aethiopicus"),
    ("Camphora officinarum", "Cinnamomum camphora"),
    ("Megathyrsus maximus", "Urochloa maxima"),
    ("Panicum maximum", "Urochloa maxima"),
    ("Brachiaria mutica", "Urochloa mutica"),
    ("Aristolochia littoralis", "Aristolochia elegans"),
    ("Nymphoides hydrophyllum", "Nymphoides cristata"),
    ("Phymatosorus grossus", "Microsorum grossum"),
    ("Spirodela punctata", "Landoltia punctata"),
    ("Schefflera actinophylla", "Heptapleurum actinophyllum"),
    ("Pennisetum purpureum", "Cenchrus purpureus"),
    ("Pennisetum setaceum", "Cenchrus setaceus"),
    ("Pennisetum polystachion", "Cenchrus polystachios"),
    ("Merremia tuberosa", "Distimake tuberosus"),
    ("Sansevieria hyacinthoides", "Dracaena hyacinthoides"),
    ("Bryophyllum pinnatum", "Kalanchoe pinnata"),
    ("Callistemon viminalis", "Melaleuca viminalis"),
    ("Cyperus alternifolius", "Cyperus involucratus"),
    ("Ficus retusa", "Ficus microcarpa"),
    ("Blechum pyramidatum", "Ruellia blechum"),
    ("Borreria verticillata", "Spermacoce verticillata"),
    ("Wedelia trilobata", "Sphagneticola trilobata"),
    ("Rhoeo spathacea", "Tradescantia spathacea"),
    ("Eugenia jambos", "Syzygium jambos"),
    ("Aleurites fordii", "Vernicia fordii"),
    ("Pueraria montana", "Pueraria montana var. lobata"),
    ("Pueraria lobata", "Pueraria montana var. lobata"),
    ("Senna pendula", "Senna pendula var. glabrata"),
    ("Ipomoea carnea", "Ipomoea carnea ssp. fistulosa"),
    ("Ipomoea carnea subsp. fistulosa", "Ipomoea carnea ssp. fistulosa"),
    ("Koelreuteria elegans", "Koelreuteria elegans ssp. formosana"),
    ("Kalanchoe × houghtonii", "Kalanchoe x houghtonii"),
    ("Kalanchoe ×houghtonii", "Kalanchoe x houghtonii"),
    ("Lantana × strigocamara", "Lantana strigocamara"),
])
def test_fisc_plant_found_by_the_name_plantnet_or_usda_uses(monkeypatch, name, fisc):
    _usda_says(monkeypatch, AssertionError("USDA should not be asked"))
    assert plant_option(name, "", 0.5, ZIP)["scientific_name"] == fisc
    assert get_status(name, ZIP)["source"] == "FISC"


@pytest.mark.parametrize("name", [
    "Setaria parviflora",
    "Lygodium microphyllum",
    "Vitex trifolia",
    "Solanum mammosum",
    "Hibiscus tiliaceus",
])
def test_lookalike_names_are_not_mapped_to_another_fisc_plant(name):
    assert plant_option(name, "", 0.5, ZIP)["scientific_name"] == name
