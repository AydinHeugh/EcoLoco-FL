import re

import pytest
import requests

from services import location_service
from services.location_service import county, geocode, plantings_checked, reverse_zip, round_coords, seen_near, zip_center


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
        state["calls"].append({"url": url, "params": params, "headers": headers, "timeout": timeout})
        return FakeResponse(state["reply"])

    monkeypatch.setattr(requests, "get", fake_get)
    monkeypatch.setattr(location_service, "_now", lambda: state["now"][0])
    monkeypatch.setattr(location_service, "_sleep", lambda s: (state["slept"].append(s), state["now"].__setitem__(0, state["now"][0] + s)))
    monkeypatch.setattr(location_service, "_last_call", [0.0])
    return state


@pytest.mark.parametrize("lat, lon, expected", [
    (26.36789, -80.12345, (26.37, -80.12)),
    (26.3649, -80.1251, (26.36, -80.13)),
    ("26.4", "-80.1", (26.4, -80.1)),
    (-90, 180, (-90, 180)),
    (90, -180, (90, -180)),
])
def test_round_coords_to_about_one_km(lat, lon, expected):
    assert round_coords(lat, lon) == expected


@pytest.mark.parametrize("lat, lon", [
    (None, 1), ("x", 1), (100, 0), (0, 200), (True, 1), (0, False),
    (float("nan"), 0), (0, float("nan")), (float("inf"), 0), (0, float("-inf")),
    ("NaN", 0), (0, "Infinity"), (90.004, 0), (-90.004, 0), (0, 180.004), (0, -180.004),
    ([], 0), (0, {}), (10**500, 0),
])
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
    assert calls["calls"][0]["timeout"] == (2, 3)


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
    assert calls["calls"][0]["timeout"] == (2, 3)
    assert len(calls["calls"]) == 1
    assert all(row["needs_confirmation"] and not row["user_confirmed"] for row in result)


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
    calls["reply"] = [{"lat": "26.7153", "lon": "-80.0534"}]
    assert zip_center("33401") == (26.72, -80.05)
    assert calls["calls"][0]["params"]["postalcode"] == "33401"
    assert "q" not in calls["calls"][0]["params"]


def test_zip_center_survives_lookup_down(monkeypatch):
    def down(*args, **kwargs):
        raise requests.ConnectionError("down")

    monkeypatch.setattr(requests, "get", down)
    assert zip_center("33401") is None


@pytest.mark.parametrize("query", [None, True, [], {}, 33401, "", " \t", "x" * 201])
def test_geocode_rejects_invalid_queries_without_network(calls, query):
    with pytest.raises(ValueError):
        geocode(query)
    assert calls["calls"] == []


@pytest.mark.parametrize("zip_code", [None, True, [], {}, 33401, "", "3340", "334011", "３３４０１", "33401-1234"])
def test_invalid_zip_inputs_are_safe_and_do_not_call_provider(calls, zip_code):
    assert zip_center(zip_code) is None
    assert county(zip_code) is None
    assert plantings_checked(zip_code) is False
    assert calls["calls"] == []


def test_county_mapping_limits_planting_advice_and_normalizes_whitespace(calls):
    assert county(" 33401 ") == "Palm Beach"
    assert plantings_checked("34990") is False
    assert plantings_checked("33431") is True
    assert county("32301") == "Leon"
    assert plantings_checked("32301") is False
    assert calls["calls"] == []


@pytest.mark.parametrize("reply", [
    None, {}, "bad response", [None], ["bad place"], [{}],
    [{"lat": "NaN", "lon": 0}], [{"lat": 90.004, "lon": 0}],
    [{"lat": True, "lon": -80}], [{"lat": 26, "lon": []}],
])
def test_malformed_geocoder_results_fail_safely(calls, reply):
    calls["reply"] = reply
    assert geocode("Boca Raton FL") is None
    assert zip_center("33401") is None


@pytest.mark.parametrize("reply", [
    None, [], "bad response", {}, {"address": []}, {"address": "33401"},
    {"address": {"postcode": 33401}}, {"address": {"postcode": "３３４０１"}},
    {"address": {"postcode": "33401 invalid"}}, {"address": {"postcode": "33401-123"}},
    {"address": {"postcode": "33401", "country_code": "mx"}},
])
def test_malformed_or_non_us_reverse_results_return_none(calls, reply):
    calls["reply"] = reply
    assert reverse_zip(26.36789, -80.12345) is None
    assert calls["calls"][0]["params"]["lat"] == 26.37
    assert calls["calls"][0]["params"]["lon"] == -80.12


@pytest.mark.parametrize("lookup", [reverse_zip, seen_near])
@pytest.mark.parametrize("lat, lon", [(True, 0), (0, float("nan")), (90.004, 0)])
def test_coordinate_lookups_reject_invalid_inputs_before_network(calls, lookup, lat, lon):
    with pytest.raises(ValueError):
        lookup(lat, lon)
    assert calls["calls"] == []


@pytest.mark.parametrize("error", [
    requests.Timeout("secret address and key"),
    requests.HTTPError("secret address and key"),
    ValueError("secret address and key"),
])
def test_provider_failures_are_safe_and_logs_do_not_include_request_data(calls, monkeypatch, caplog, error):
    def broken(*args, **kwargs):
        raise error

    monkeypatch.setattr(requests, "get", broken)
    assert geocode("private school street") is None
    assert zip_center("33401") is None
    assert reverse_zip(26.37, -80.13) is None
    assert seen_near(26.37, -80.13) == []
    assert type(error).__name__ in caplog.text
    assert "secret" not in caplog.text
    assert "private school" not in caplog.text
    assert "33401" not in caplog.text


def test_busy_nominatim_queue_fails_quickly_without_network(calls, monkeypatch):
    timeouts = []

    class BusyLock:
        def acquire(self, timeout):
            timeouts.append(timeout)
            return False

        def release(self):
            pytest.fail("An unacquired lock must not be released")

    monkeypatch.setattr(location_service, "_lock", BusyLock())
    assert geocode("Boca Raton FL") is None
    assert timeouts == [0.25]
    assert calls["calls"] == []


def test_geocode_preserves_rounded_point_when_reverse_lookup_is_unavailable(calls, monkeypatch):
    replies = iter([
        [{"lat": "26.3587", "lon": "-80.0831", "address": []}],
        None,
    ])
    monkeypatch.setattr(requests, "get", lambda *args, **kwargs: FakeResponse(next(replies)))
    assert geocode("Boca Raton FL") == {"lat": 26.36, "lon": -80.08, "zip": None}


@pytest.mark.parametrize("reply", [None, [], "bad response", {}, {"results": None}, {"results": {}}, {"results": "bad"}])
def test_malformed_nearby_results_fail_safely(calls, reply):
    calls["reply"] = reply
    assert seen_near(26.37, -80.13) == []


@pytest.mark.parametrize("bad_row", [
    None, [], "bad row", {}, {"taxon": []}, {"taxon": None},
    {"taxon": {"name": None}, "count": 1}, {"taxon": {"name": []}, "count": 1},
    {"taxon": {"name": " "}, "count": 1}, {"taxon": {"name": "x" * 201}, "count": 1},
    *({"taxon": {"name": "Zamia integrifolia"}, "count": count} for count in [None, -1, True, "2", 1.5]),
])
def test_bad_nearby_rows_do_not_discard_valid_neighbors(calls, bad_row):
    calls["reply"] = {"results": [bad_row, {"count": 12, "taxon": {"name": "Zamia integrifolia"}}]}
    result = seen_near(26.37, -80.13)
    assert len(result) == 1
    assert result[0]["scientific_name"] == "Zamia integrifolia"
    assert result[0]["count"] == 12
    assert len(calls["calls"]) == 1


def test_nearby_enrichment_is_bounded_and_keeps_exact_taxa(calls, monkeypatch):
    names = ["Hamelia patens var. glabra", "Ficus microcarpa subsp. fuyuensis", "Zamia integrifolia var. unknown", "Hamelia patens", "Zamia integrifolia", "Ignored extra taxon"]
    calls["reply"] = {"results": [{"count": 2, "taxon": {"name": name, "preferred_common_name": []}} for name in names]}
    enriched = []

    def option(scientific_name, common_name):
        enriched.append((scientific_name, common_name))
        return {"scientific_name": scientific_name}

    monkeypatch.setattr(location_service, "_plant_option", option)
    result = seen_near(26.37, -80.13)
    assert [row["scientific_name"] for row in result] == names[:5]
    assert enriched == [(name, "") for name in names[:5]]
    assert len(calls["calls"]) == 1


def test_one_failed_evidence_lookup_keeps_other_nearby_results(calls, monkeypatch, caplog):
    calls["reply"] = {"results": [
        {"count": 1, "taxon": {"name": "Broken species"}},
        {"count": 2, "taxon": {"name": "Zamia integrifolia"}},
    ]}

    def option(name, *args):
        if name == "Broken species":
            raise ValueError("private provider payload")
        return {"scientific_name": name}

    monkeypatch.setattr(location_service, "_plant_option", option)
    result = seen_near(26.37, -80.13)
    assert [row["scientific_name"] for row in result] == ["Zamia integrifolia"]
    assert "private provider payload" not in caplog.text
