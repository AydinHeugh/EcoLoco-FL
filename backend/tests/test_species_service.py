import json

import pytest

from services import species_service
from services.fl_plants_service import get_status
from services.species_service import common_name, resolve

COONTIE_LABELS = ["Coontie", "coontie", "Zamia integrifolia", "Florida Arrowroot", "Zamia pumila", "Zamia integrifolia L."]


@pytest.mark.parametrize("label", COONTIE_LABELS)
def test_every_coontie_label_resolves_to_one_species(label):
    assert resolve(label) == "Zamia integrifolia"


def test_all_coontie_labels_get_the_same_status():
    statuses = {json.dumps(get_status(label, "33496"), sort_keys=True) for label in COONTIE_LABELS}
    assert len(statuses) == 1
    assert get_status("Florida Arrowroot", "33496")["source"] == "fl_natives"


def test_brazilian_pepper_spellings_resolve():
    assert resolve("Schinus terebinthifolius") == resolve("Brazilian pepper") == "Schinus terebinthifolia"


def test_ambiguous_common_name_resolves_to_none(monkeypatch):
    monkeypatch.setattr(species_service, "_entries", lambda: [
        {"scientific_name": "Plantus alpha", "common_name": "Twin bush"},
        {"scientific_name": "Plantus beta", "common_name": "twin bush"},
    ])
    species_service._index.cache_clear()
    try:
        assert resolve("Twin bush") is None
        assert resolve("Plantus alpha") == "Plantus alpha"
    finally:
        species_service._index.cache_clear()


@pytest.mark.parametrize("name", ["Welwitschia mirabilis", "", None, "   "])
def test_unknown_name_resolves_to_none(name):
    assert resolve(name) is None


def test_common_name_for_scientific_name():
    assert common_name("Zamia integrifolia") == "Coontie"
    assert common_name("Welwitschia mirabilis") is None
