import re

import pytest
import requests

from services import location_service, usda_service
from services.location_service import geocode, reverse_zip, round_coords, seen_near


class FakeResponse:
    def __init__(self, body):
        self._body = body

    def raise_for_status(self):
        pass

    def json(self):
        return self._body


@pytest.fixture
def calls(monkeypatch):
    state = {"calls": [], "reply": None, "now": [100.0], "slept": []}

    def fake_get(url, params=None, headers=None, timeout=None):
        state["calls"].append({"url": url, "params": params, "headers": headers})
        return FakeResponse(state["reply"])

    monkeypatch.setattr(requests, "get", fake_get)
    monkeypatch.setattr(location_service, "_now", lambda: state["now"][0])
    monkeypatch.setattr(location_service, "_sleep", lambda s: (state["slept"].append(s), state["now"].__setitem__(0, state["now"][0] + s)))
    monkeypatch.setattr(location_service, "_last_call", [0.0])
    monkeypatch.setattr(usda_service, "florida_status", lambda name: None)
    return state


@pytest.mark.parametrize("lat, lon, expected", [
    (26.36789, -80.12345, (26.37, -80.12)),
    (26.3649, -80.1251, (26.36, -80.13)),
    ("26.4", "-80.1", (26.4, -80.1)),
])
def test_round_coords_to_about_one_km(lat, lon, expected):
    assert round_coords(lat, lon) == expected


@pytest.mark.parametrize("lat, lon", [(None, 1), ("x", 1), (100, 0), (0, 200)])
def test_round_coords_rejects_bad_values(lat, lon):
    with pytest.raises(ValueError):
        round_coords(lat, lon)


def test_geocode_sends_user_agent_without_email(calls):
    calls["reply"] = [{"lat": "26.3678", "lon": "-80.1289", "address": {"postcode": "33496"}}]
    assert geocode("Boca Raton FL") == {"lat": 26.37, "lon": -80.13, "zip": "33496"}
    headers = calls["calls"][0]["headers"]
    assert headers["User-Agent"].startswith("EcoLoco-FL")
    assert not re.search(r"[\w.]+@[\w.]+", headers["User-Agent"])
    assert calls["calls"][0]["url"].startswith("https://nominatim.openstreetmap.org/")


def test_geocode_returns_none_when_nothing_found(calls):
    calls["reply"] = []
    assert geocode("nowhere at all") is None


def test_reverse_zip_reads_postcode(calls):
    calls["reply"] = {"address": {"postcode": "33496-1234"}}
    assert reverse_zip(26.37, -80.13) == "33496"
    assert calls["calls"][0]["params"]["lat"] == 26.37


def test_second_nominatim_call_within_a_second_waits(calls):
    calls["reply"] = []
    geocode("a")
    calls["now"][0] += 0.3
    geocode("b")
    assert calls["slept"] and calls["slept"][-1] == pytest.approx(0.7)


def test_seen_near_asks_inaturalist_for_research_grade_plants_within_5_km(calls):
    calls["reply"] = {"results": [
        {"count": 12, "taxon": {"name": "Zamia integrifolia", "preferred_common_name": "coontie"}},
        {"count": 9, "taxon": {"name": "Schinus terebinthifolia", "preferred_common_name": "Brazilian peppertree"}},
    ]}
    result = seen_near(26.3678, -80.1289)
    params = calls["calls"][0]["params"]
    assert calls["calls"][0]["url"] == "https://api.inaturalist.org/v1/observations/species_counts"
    assert params["radius"] == 5 and params["quality_grade"] == "research"
    assert params["iconic_taxa"] == "Plantae" and params["per_page"] == 5
    assert (params["lat"], params["lng"]) == (26.37, -80.13)
    assert [(r["plant_name"], r["count"], r["status"]) for r in result] == [
        ("Coontie", 12, "native"), ("Brazilian pepper", 9, "invasive")]
    assert not re.search(r"[\w.]+@[\w.]+", calls["calls"][0]["headers"]["User-Agent"])


def test_seen_near_survives_inaturalist_down(monkeypatch):
    def down(*args, **kwargs):
        raise requests.ConnectionError("down")

    monkeypatch.setattr(requests, "get", down)
    assert seen_near(26.37, -80.13) == []


def test_geocode_city_without_postcode_looks_up_zip_at_its_center(calls, monkeypatch):
    replies = iter([
        [{"lat": "26.3587", "lon": "-80.0831", "address": {"city": "Boca Raton", "state": "Florida"}}],
        {"address": {"postcode": "33432"}},
    ])
    monkeypatch.setattr(requests, "get", lambda url, params=None, headers=None, timeout=None: (
        calls["calls"].append({"url": url, "params": params}) or FakeResponse(next(replies))))
    assert geocode("Boca Raton, FL") == {"lat": 26.36, "lon": -80.08, "zip": "33432"}
    assert calls["calls"][1]["url"].endswith("/reverse")


def test_zip_center_uses_a_postal_code_search(calls):
    from services.location_service import zip_center
    calls["reply"] = [{"lat": "26.7153", "lon": "-80.0534"}]
    assert zip_center("33401") == (26.72, -80.05)
    assert calls["calls"][0]["params"]["postalcode"] == "33401"
    assert "q" not in calls["calls"][0]["params"]


def test_zip_center_survives_lookup_down(monkeypatch):
    from services.location_service import zip_center

    def down(*args, **kwargs):
        raise requests.ConnectionError("down")

    monkeypatch.setattr(requests, "get", down)
    assert zip_center("33401") is None
