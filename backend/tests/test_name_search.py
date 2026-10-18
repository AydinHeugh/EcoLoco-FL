import json

import pytest

import app as app_module
from scripts.build_fl_plant_names import clean_name, plant_names
from services import usda_service
from services.name_search import MAX_RESULTS, common_name_for, is_known, search
from services.species_service import DATA_DIR

NAMES = json.loads((DATA_DIR / "fl_plant_names.json").read_text(encoding="utf-8"))["plants"]


@pytest.fixture
def client():
    app_module.app.config["TESTING"] = True
    return app_module.app.test_client()


@pytest.mark.parametrize("raw, expected", [
    ("Abildgaardia ovata (Burm. f.) Kral", "Abildgaardia ovata"),
    ("Abelia ×grandiflora (Rovelli ex André) Rehder [chinensis × uniflora]", "Abelia ×grandiflora"),
    ("Helianthus debilis Nutt. ssp. debilis", "Helianthus debilis subsp. debilis"),
    ("Pinus elliottii Engelm. var. densa Little & K.W. Dorman", "Pinus elliottii var. densa"),
    ("Zamia furfuracea L. f. ex Aiton", "Zamia furfuracea"),
    ("Quercus L.", None),
])
def test_clean_name(raw, expected):
    assert clean_name(raw) == expected


def test_plant_names_skips_synonyms_and_repeats():
    text = "\n".join([
        "Search type: State",
        "Accepted Symbol,Synonym,Scientific Name,Common Name",
        '"ZAPU2",,"Zamia pumila L.",coontie',
        '"ZAPU2","ZAIN","Zamia integrifolia L. f. ex Aiton",',
        '"QUVI",,"Quercus virginiana Mill.",live oak',
        '"QUVI2",,"Quercus virginiana Mill. f. alba",live oak',
    ])
    assert plant_names(text) == [
        {"scientific_name": "Quercus virginiana", "common_name": "live oak"},
        {"scientific_name": "Zamia pumila", "common_name": "coontie"},
    ]


def test_name_list_covers_florida():
    assert len(NAMES) > 5000
    assert len({p["scientific_name"] for p in NAMES}) == len(NAMES)


@pytest.mark.parametrize("query, expected", [
    ("coontie", "Zamia integrifolia"),
    ("Zamia pumila", "Zamia integrifolia"),
    ("firebush", "Hamelia patens"),
    ("brazilian pepper", "Schinus terebinthifolia"),
    ("leavenworth", "Coreopsis leavenworthii"),
])
def test_search_finds_plants_by_any_name(query, expected):
    assert expected in [r["scientific_name"] for r in search(query)]


def test_search_returns_names_only():
    for result in search("sage"):
        assert set(result) == {"scientific_name", "common_name"}


def test_search_is_capped_and_needs_two_letters():
    assert len(search("a")) == 0
    assert len(search("an")) == MAX_RESULTS


def test_known_names():
    assert is_known("Zamia pumila") and is_known("Coreopsis leavenworthii")
    assert not is_known("Madeupia fakeii")
    assert common_name_for("Hamelia patens") == "Firebush"


def test_names_route(client):
    body = client.post("/names", json={"query": "coontie"}).get_json()
    assert body["result"][0]["scientific_name"] == "Zamia integrifolia"


@pytest.mark.parametrize("query", [None, 5, "x" * 81])
def test_names_route_rejects_bad_queries(client, query):
    assert client.post("/names", json={"query": query}).status_code == 400


@pytest.mark.parametrize("name, status", [
    ("Zamia integrifolia", "native"),
    ("Schinus terebinthifolia", "invasive"),
    ("Salvia coccinea", "non-native"),
])
def test_choose_runs_the_same_status_check(client, name, status):
    result = client.post("/choose", json={"scientific_name": name, "location": "33431"}).get_json()["result"]
    assert result["status"] == status
    assert result["id_source"] == "by_name"
    assert result["state"] == "identified"
    assert result["confidence"] is None
    assert result["options"][0]["scientific_name"] == result["scientific_name"]


def test_choose_asks_usda_for_plants_not_on_our_lists(client, monkeypatch):
    asked = []
    monkeypatch.setattr(usda_service, "florida_status", lambda name: asked.append(name) or "native")
    result = client.post("/choose", json={"scientific_name": "Abildgaardia ovata", "location": "33431"}).get_json()["result"]
    assert asked == ["Abildgaardia ovata"]
    assert (result["status"], result["source"]) == ("native", "USDA")


@pytest.mark.parametrize("body, code", [
    ({"scientific_name": "Madeupia fakeii", "location": "33431"}, 400),
    ({"scientific_name": "Zamia integrifolia", "location": "10001"}, 400),
    ({"location": "33431"}, 400),
])
def test_choose_rejects_bad_requests(client, body, code):
    assert client.post("/choose", json=body).status_code == code
