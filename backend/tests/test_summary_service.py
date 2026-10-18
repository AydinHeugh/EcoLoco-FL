import pytest

from services import usda_service
from services.summary_service import summarize

INTRODUCED = {"Ixora coccinea", "Zamia furfuracea"}


@pytest.fixture(autouse=True)
def usda(monkeypatch):
    monkeypatch.setattr(usda_service, "florida_status",
                        lambda name: "introduced" if name in INTRODUCED else None)


def test_spellings_of_same_species_give_identical_summary():
    results = [summarize([{"scientific_name": label}, {"scientific_name": "Brazilian pepper"}])
               for label in ["Coontie", "coontie", "Zamia integrifolia", "Florida Arrowroot"]]
    assert all(r["counts"] == results[0]["counts"] for r in results)
    assert all(r["percent_native"] == results[0]["percent_native"] for r in results)
    assert results[0]["counts"] == {"native": 1, "non_native": 0, "invasive": 1, "unknown": 0}


def test_percent_native_and_projection():
    s = summarize([
        {"scientific_name": "Zamia integrifolia"},
        {"scientific_name": "Hamelia patens"},
        {"scientific_name": "Ixora coccinea"},
        {"scientific_name": "Schinus terebinthifolia"},
        {"scientific_name": "Welwitschia mirabilis"},
    ])
    assert s["counts"] == {"native": 2, "non_native": 1, "invasive": 1, "unknown": 1}
    assert s["known"] == 4
    assert s["plant_count"] == 5
    assert s["percent_native"] == 50
    assert s["percent_native_with_plan"] == 75


def test_added_natives_raise_the_projection():
    s = summarize([{"scientific_name": "Ixora coccinea"}, {"scientific_name": "Schinus terebinthifolia"}], added_natives=2)
    assert s["percent_native"] == 0
    assert s["percent_native_with_plan"] == 75


def test_only_unknown_plants_gives_none():
    s = summarize([{"scientific_name": ""}, {"scientific_name": "Welwitschia mirabilis"}])
    assert s["percent_native"] is None
    assert s["percent_native_with_plan"] is None
    assert s["counts"]["unknown"] == 2


def test_unknown_plants_stay_listed():
    s = summarize([{"scientific_name": "", "plant_name": "Unidentified plant"}, {"scientific_name": "Zamia pumila"}])
    assert [(p["plant_name"], p["status"]) for p in s["plants"]] == [("Unidentified plant", "unknown"), ("Coontie", "native")]
    assert s["plants"][1]["status_label"] == "Native"
    assert s["plants"][1]["source_label"] == "EcoLoco South Florida native list"


def test_names_never_change_counts():
    a = summarize([{"scientific_name": "Ixora coccinea", "plant_name": "Ixora"}])
    b = summarize([{"scientific_name": "Ixora coccinea", "plant_name": "Totally different label"}])
    assert a["counts"] == b["counts"]


def test_counts_with_plan_replace_invasives_and_add_natives():
    s = summarize([{"scientific_name": "Ixora coccinea"}, {"scientific_name": "Schinus terebinthifolia"},
                   {"scientific_name": ""}], added_natives=2)
    assert s["counts_with_plan"] == {"native": 3, "non_native": 1, "invasive": 0, "unknown": 1}


def test_kinds_count_each_species_once():
    s = summarize([{"scientific_name": "Zamia integrifolia"}, {"scientific_name": "Zamia integrifolia"},
                   {"scientific_name": "Coontie"}, {"scientific_name": "Ixora coccinea"}, {"scientific_name": ""}])
    assert s["percent_native"] == 75
    assert s["kinds"] == {"native": 1, "non_native": 1, "invasive": 0}
    assert s["percent_native_kinds"] == 50


def test_kinds_with_plan_drop_replaced_invasives_and_add_new_natives():
    plants = [{"scientific_name": "Schinus terebinthifolia"}, {"scientific_name": "Schinus terebinthifolia"},
              {"scientific_name": "Ixora coccinea"}]
    s = summarize(plants, added_natives=1)
    assert s["percent_native_kinds"] == 0
    assert s["percent_native_kinds_with_plan"] == 67


def test_kinds_with_plan_use_named_species_from_the_plan():
    from services.summary_service import with_plan
    base = summarize([{"scientific_name": "Zamia integrifolia"}, {"scientific_name": "Schinus terebinthifolia"}])
    s = with_plan(base, 0, 1, added_kinds=["Zamia integrifolia"], removed_kinds=["Schinus terebinthifolia"])
    assert s["percent_native_kinds_with_plan"] == 100
    assert s["kinds_with_plan"] == {"native": 1, "non_native": 0, "invasive": 0}


def test_only_unknown_plants_gives_no_kinds_percent():
    s = summarize([{"scientific_name": ""}])
    assert s["percent_native_kinds"] is None
    assert s["percent_native_kinds_with_plan"] is None
