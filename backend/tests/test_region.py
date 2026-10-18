import json

import pytest

import app as app_module
from scripts.build_zip_counties import zip_counties
from services.location_service import SOUTH_FLORIDA, county, in_south_florida
from services.plan_service import build_plan
from services.species_service import DATA_DIR
from tests.helpers import PHOTO

PEPPER = {"scientific_name": "Schinus terebinthifolius", "plant_name": "Brazilian peppertree"}
ZIPS = json.loads((DATA_DIR / "fl_zip_counties.json").read_text(encoding="utf-8"))["zips"]
SOUTH_ZIPS = {"Palm Beach": "33401", "Broward": "33301", "Miami-Dade": "33139", "Martin": "34990",
              "Monroe": "33040", "Collier": "34102", "Lee": "33901", "Hendry": "33440", "Glades": "33471",
              "Okeechobee": "34972", "St. Lucie": "34950", "Charlotte": "33950"}
ELSEWHERE = {"Leon": "32301", "Orange": "32801", "Hillsborough": "33602", "Sarasota": "34236", "Duval": "32202"}


@pytest.fixture
def client():
    app_module.app.config["TESTING"] = True
    return app_module.app.test_client()


def test_south_florida_is_the_twelve_counties():
    assert SOUTH_FLORIDA == set(SOUTH_ZIPS)


def test_zip_data_covers_every_florida_county():
    assert len(set(ZIPS.values())) == 67
    assert SOUTH_FLORIDA <= set(ZIPS.values())
    assert all(len(z) == 5 and z.isdigit() for z in ZIPS)


@pytest.mark.parametrize("name, zip_code", SOUTH_ZIPS.items())
def test_south_florida_zips(name, zip_code):
    assert county(zip_code) == name
    assert in_south_florida(zip_code) is True


@pytest.mark.parametrize("name, zip_code", ELSEWHERE.items())
def test_rest_of_florida_zips(name, zip_code):
    assert county(zip_code) == name
    assert in_south_florida(zip_code) is False


def test_unknown_zip_is_not_south_florida():
    assert county("32099") is None
    assert in_south_florida("32099") is False


def test_outside_south_florida_plan_keeps_removals_but_adds_nothing():
    plan = build_plan([PEPPER, {"scientific_name": "Zamia integrifolia"}], south_florida=False)
    assert plan["south_florida"] is False
    assert plan["add"] == []
    assert [c["plant_name"] for c in plan["remove"]] == ["Brazilian pepper"]
    assert plan["remove"][0]["replacement"] is None
    assert "effect" not in plan["remove"][0]
    assert plan["summary"]["percent_native_with_plan"] == plan["summary"]["percent_native"]


def test_south_florida_plan_still_recommends():
    plan = build_plan([PEPPER])
    assert plan["south_florida"] is True
    assert plan["add"]
    assert plan["remove"][0]["replacement"]


@pytest.mark.parametrize("zip_code, south", [("33401", True), ("32301", False)])
def test_plan_route_uses_the_zip_region(client, zip_code, south):
    result = client.post("/plan", json={"location": zip_code, "plants": [PEPPER]}).get_json()["result"]
    assert result["south_florida"] is south
    assert bool(result["add"]) is south
    assert result["remove"][0]["plant_name"] == "Brazilian pepper"


@pytest.mark.parametrize("zip_code, south", [("33401", True), ("32301", False)])
def test_recommend_route_uses_the_zip_region(client, zip_code, south):
    body = client.post("/recommend", json={"location": zip_code}).get_json()
    assert body["south_florida"] is south
    assert bool(body["result"]) is south


def test_scanning_still_works_anywhere_in_florida(client, monkeypatch):
    monkeypatch.setattr(app_module, "identify_plant", lambda images, location: {"state": "identified", "options": []})
    response = client.post("/identify", json={"images": [PHOTO], "location": "32301"})
    assert response.status_code == 200


def test_zip_builder_picks_the_county_with_most_land():
    header = "GEOID_ZCTA5_20|GEOID_COUNTY_20|NAMELSAD_COUNTY_20|AREALAND_PART"
    rows = [
        "33401|12099|Palm Beach County|900",
        "33401|12085|Martin County|100",
        "32003|13049|Charlton County|50",
        "|12099|Palm Beach County|5",
        "32004|12089|Nassau County|10",
        "32004|13049|Charlton County|90",
    ]
    assert zip_counties("\n".join([header, *rows])) == {"33401": "Palm Beach"}
