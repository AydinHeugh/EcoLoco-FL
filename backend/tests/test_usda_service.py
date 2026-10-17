from collections import OrderedDict

import pytest
import requests

from services import usda_service
from services.usda_service import florida_distribution, florida_status

HAMELIA = {"Plant": {"Id": 48114, "Symbol": "HAPA3", "ScientificName": "<i>Hamelia patens</i> Jacq."}}
HAMELIA_CUPREA = {"Plant": {"Id": 48110, "Symbol": "HACU", "ScientificName": "<i>Hamelia cuprea</i> Griseb."}}
CSV_FLORIDA = "Distribution Data\nSymbol,Country,State,State FIP,County,County FIP\nHAPA3,United States,Florida,12,,\nHAPA3,United States,Florida,12,Brevard,009\n"
CSV_CALIFORNIA = "Distribution Data\nSymbol,Country,State,State FIP,County,County FIP\nX,United States,California,06,,\n"


class FakeResponse:
    def __init__(self, body=None, text=""):
        self._body, self.text, self.status_code = body, text, 200

    def raise_for_status(self):
        pass

    def json(self):
        return self._body


@pytest.fixture
def usda(monkeypatch):
    monkeypatch.setattr(usda_service, "_cache", OrderedDict())
    state = {
        "search": [HAMELIA],
        "profile": {"Id": 48114, "Symbol": "HAPA3", "NativeStatuses": [{"Region": "L48", "Status": "N", "Type": "Native"}]},
        "csv": CSV_FLORIDA,
        "gets": [], "posts": [], "timeouts": [],
    }

    def fake_get(url, params=None, **kwargs):
        state["gets"].append((url, params))
        state["timeouts"].append(kwargs["timeout"])
        return FakeResponse(state["search"] if url.endswith("/PlantSearch") else state["profile"])

    def fake_post(url, json=None, **kwargs):
        state["posts"].append((url, json))
        state["timeouts"].append(kwargs["timeout"])
        return FakeResponse(text=state["csv"])

    monkeypatch.setattr(requests, "get", fake_get)
    monkeypatch.setattr(requests, "post", fake_post)
    return state


def test_usda_occurrence_and_national_nativity_do_not_establish_florida_nativity(usda):
    result = florida_distribution("Hamelia patens")
    assert result["florida_recorded"] is True
    assert result["lower48_statuses"] == ["N"]
    assert result["florida_native_status"] is None
    assert "do not establish" in result["limitation"]
    assert florida_status("Hamelia patens") is None
    assert all(0 < timeout <= 4 for timeout in usda["timeouts"])


def test_legacy_nativity_lookup_does_not_make_useless_network_calls(usda):
    assert florida_status("Gaillardia pulchella") is None
    assert usda["gets"] == usda["posts"] == []


def test_usda_introduced_national_status_stays_separate(usda):
    usda["profile"]["NativeStatuses"] = [{"Region": "L48", "Status": "I", "Type": "Introduced"}]
    result = florida_distribution("Hamelia patens")
    assert result["lower48_statuses"] == ["I"]
    assert result["florida_native_status"] is None
    assert result["florida_recorded"] is True


def test_missing_florida_record_does_not_mean_introduced(usda):
    usda["csv"] = CSV_CALIFORNIA
    result = florida_distribution("Hamelia patens")
    assert result["florida_recorded"] is False
    assert result["florida_native_status"] is None


@pytest.mark.parametrize("csv", ["", "provider unavailable", "Symbol,Country,State\n", "Unexpected,Header\n1,Florida\n"])
def test_unusable_distribution_does_not_mean_no_florida_occurrence(usda, csv):
    usda["csv"] = csv
    assert florida_distribution("Hamelia patens")["florida_recorded"] is None


def test_distribution_without_title_line_is_parsed(usda):
    usda["csv"] = CSV_FLORIDA.split("\n", 1)[1]
    assert florida_distribution("Hamelia patens")["florida_recorded"] is True


def test_usda_not_found(usda):
    usda["search"] = []
    assert florida_distribution("Plantus imaginarius") is None


def test_usda_matches_exact_identity_while_ignoring_authors(usda):
    usda["search"] = [HAMELIA_CUPREA, HAMELIA]
    florida_distribution("Hamelia patens Jacq.")
    assert usda["gets"][1][1] == {"symbol": "HAPA3"}


def test_requested_variety_never_matches_bare_species(usda):
    assert florida_distribution("Hamelia patens Jacq. var. glabra") is None
    assert len(usda["gets"]) == 1
    assert usda["posts"] == []


def test_usda_uses_accepted_profile_for_distribution(usda):
    usda["search"] = [{"Plant": {"Id": 1, "Symbol": "ZAIN", "ScientificName": "<i>Zamia integrifolia</i> L. f."}}]
    usda["profile"] = {"Id": 15671, "Symbol": "ZAPUP", "NativeStatuses": [{"Region": "L48", "Status": "N"}]}
    assert florida_distribution("Zamia integrifolia")["florida_recorded"] is True
    assert usda["posts"][0][1]["MasterId"] == 15671
    assert usda["posts"][0][1]["Text"] == "ZAPUP"


def test_usda_result_is_cached_and_mutation_safe(usda):
    result = florida_distribution("Hamelia patens")
    result["lower48_statuses"].append("tampered")
    assert florida_distribution("  hamelia PATENS ")["lower48_statuses"] == ["N"]
    assert len(usda["gets"]) == 2


def test_cache_expires_and_is_bounded(usda, monkeypatch):
    monkeypatch.setattr(usda_service, "CACHE_SIZE", 2)
    florida_distribution("Hamelia patens")
    florida_distribution("Hamelia cuprea")
    florida_distribution("Plantus imaginarius")
    assert len(usda_service._cache) == 2
    monkeypatch.setattr(usda_service, "CACHE_SECONDS", -1)
    prior_calls = len(usda["gets"])
    florida_distribution("Plantus imaginarius")
    assert len(usda["gets"]) == prior_calls + 1


def test_provider_failure_is_not_cached_as_no_occurrence(usda, monkeypatch):
    def failed(*args, **kwargs):
        raise requests.Timeout("unavailable")
    monkeypatch.setattr(requests, "post", failed)
    with pytest.raises(requests.Timeout):
        florida_distribution("Hamelia patens")
    assert usda_service._cache == {}


def test_missing_native_status_is_unknown_even_with_occurrence(usda):
    usda["profile"]["NativeStatuses"] = None
    result = florida_distribution("Hamelia patens")
    assert result["lower48_statuses"] == []
    assert result["florida_native_status"] is None
