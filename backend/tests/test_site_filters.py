import json

import pytest

import app as app_module
from services import plan_service
from services.plan_service import build_plan, clean_site, fits_site, light_of, space_of
from services.species_service import DATA_DIR

RECS = json.loads((DATA_DIR / "fl_recommendations.json").read_text(encoding="utf-8"))["species"]
BY_NAME = {e["common_name"]: e for e in RECS}
OPEN = clean_site(None)


@pytest.fixture
def client():
    app_module.app.config["TESTING"] = True
    return app_module.app.test_client()


def _site(**choices):
    return clean_site(choices)


def _checked(rec, **fields):
    rec = dict(rec)
    for field, value in fields.items():
        rec[field] = dict(rec[field], value=value, verified=True)
    return rec


@pytest.mark.parametrize("entry", RECS, ids=lambda e: e["common_name"])
def test_every_plant_has_sourced_unverified_moisture_and_care(entry):
    for field in ("moisture", "care"):
        assert entry[field]["source"]["url"].startswith("https://")
        assert entry[field]["basis"]
        assert entry[field]["verified"] is False
    assert set(entry["moisture"]["value"]) <= {"dry", "average", "wet"} and entry["moisture"]["value"]
    assert entry["care"]["value"] in {"low", "moderate"}


@pytest.mark.parametrize("entry", RECS, ids=lambda e: e["common_name"])
def test_light_and_space_come_from_our_sun_and_size(entry):
    assert light_of(entry)
    assert space_of(entry) in {"small", "medium", "large"}


def test_light_and_space_readings():
    assert light_of(BY_NAME["Swamp milkweed"]) == ["full", "part", "shade"]
    assert light_of(BY_NAME["Live oak"]) == ["full"]
    assert space_of(BY_NAME["Live oak"]) == "large"
    assert space_of(BY_NAME["Sunshine mimosa"]) == "small"
    assert space_of(BY_NAME["Firebush"]) == "medium"


def test_bad_choices_become_unknown():
    assert clean_site({"light": "moonlight", "space": "small", "extra": 1}) == {
        "light": "unknown", "moisture": "unknown", "space": "small", "care": "unknown"}


def test_no_choices_hide_nothing():
    assert all(fits_site(rec, OPEN) for rec in RECS)


def test_light_filter():
    assert not fits_site(BY_NAME["Live oak"], _site(light="part"))
    assert fits_site(BY_NAME["Swamp milkweed"], _site(light="shade"))


def test_space_filter_allows_smaller_plants():
    assert fits_site(BY_NAME["Sunshine mimosa"], _site(space="medium"))
    assert not fits_site(BY_NAME["Live oak"], _site(space="medium"))
    assert fits_site(BY_NAME["Live oak"], _site(space="large"))


def test_unchecked_moisture_and_care_never_hide_a_plant():
    red_maple = BY_NAME["Red maple"]
    assert "dry" not in red_maple["moisture"]["value"]
    assert fits_site(red_maple, _site(moisture="dry", care="low"))


def test_checked_moisture_and_care_do_filter():
    red_maple = _checked(BY_NAME["Red maple"], moisture=["average", "wet"], care="moderate")
    assert not fits_site(red_maple, _site(moisture="dry"))
    assert fits_site(red_maple, _site(moisture="wet"))
    assert not fits_site(red_maple, _site(care="low"))
    assert fits_site(red_maple, _site(care="moderate"))


def test_plan_counts_hidden_plants():
    plan = build_plan([], site={"space": "small"})
    assert plan["hidden_by_site"] > 0
    assert all(space_of(card) == "small" for card in plan["add"])
    assert build_plan([])["hidden_by_site"] == 0


def test_plan_uses_checked_moisture(monkeypatch):
    recs = [_checked(rec, moisture=["average", "wet"]) if rec["common_name"] == "Red maple" else rec for rec in RECS]
    monkeypatch.setattr(plan_service, "_recommendations", lambda: recs)
    names = {c["common_name"] for c in build_plan([], site={"moisture": "dry"})["add"]}
    assert "Red maple" not in names


def test_recommend_route_takes_site(client):
    body = client.post("/recommend", json={"location": "33431", "site": {"space": "small"}}).get_json()
    assert body["hidden_by_site"] > 0
    assert all(space_of(card) == "small" for card in body["result"])


@pytest.mark.parametrize("route, extra", [("/recommend", {}), ("/plan", {"plants": []})])
def test_routes_reject_a_bad_site(client, route, extra):
    response = client.post(route, json={"location": "33431", "site": "sunny", **extra})
    assert response.status_code == 400
