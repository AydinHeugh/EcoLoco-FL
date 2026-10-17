import pytest
import requests

from services import usda_service
from services.usda_service import florida_status

HAMELIA = {"Text": "<i>Hamelia patens</i> Jacq.", "Plant": {"Id": 48114, "Symbol": "HAPA3", "ScientificName": "<i>Hamelia patens</i> Jacq."}}
HAMELIA_CUPREA = {"Text": "<i>Hamelia cuprea</i> Griseb.", "Plant": {"Id": 48110, "Symbol": "HACU", "ScientificName": "<i>Hamelia cuprea</i> Griseb."}}
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
    monkeypatch.setattr(usda_service, "_cache", {})
    state = {
        "search": [HAMELIA],
        "profile": {"Id": 48114, "Symbol": "HAPA3", "NativeStatuses": [{"Region": "L48", "Status": "N", "Type": "Native"}]},
        "csv": CSV_FLORIDA,
        "gets": [],
        "posts": [],
    }

    def fake_get(url, params=None, **kwargs):
        state["gets"].append((url, params))
        return FakeResponse(state["search"] if url.endswith("/PlantSearch") else state["profile"])

    def fake_post(url, json=None, **kwargs):
        state["posts"].append((url, json))
        return FakeResponse(text=state["csv"])

    monkeypatch.setattr(requests, "get", fake_get)
    monkeypatch.setattr(requests, "post", fake_post)
    return state


def test_usda_native_in_florida(usda):
    assert florida_status("Hamelia patens") == "native"
    url, body = usda["posts"][0]
    assert url == "https://plantsservices.sc.egov.usda.gov/api/PlantProfile/getDownloadDistributionDocumentation"
    assert body == {"Field": "Symbol", "Text": "HAPA3", "SortBy": "sortSciName", "Offset": None, "MasterId": 48114}
    assert usda["gets"][0] == ("https://plantsservices.sc.egov.usda.gov/api/PlantSearch", {"searchText": "Hamelia patens"})
    assert usda["gets"][1] == ("https://plantsservices.sc.egov.usda.gov/api/PlantProfile", {"symbol": "HAPA3"})


def test_usda_introduced(usda):
    usda["profile"]["NativeStatuses"] = [{"Region": "L48", "Status": "I", "Type": "Introduced"}]
    assert florida_status("Hamelia patens") == "introduced"
    assert usda["posts"] == []


def test_usda_us_native_not_in_florida_is_introduced(usda):
    usda["csv"] = CSV_CALIFORNIA
    assert florida_status("Hamelia patens") == "introduced"


def test_usda_not_found(usda):
    usda["search"] = []
    assert florida_status("Plantus imaginarius") is None


def test_usda_matches_search_result_by_binomial(usda):
    usda["search"] = [HAMELIA_CUPREA, HAMELIA]
    florida_status("Hamelia patens Jacq.")
    assert usda["gets"][1][1] == {"symbol": "HAPA3"}


def test_usda_uses_accepted_profile_for_distribution(usda):
    usda["search"] = [{"Plant": {"Id": 1, "Symbol": "ZAIN", "ScientificName": "<i>Zamia integrifolia</i> L. f."}}]
    usda["profile"] = {"Id": 15671, "Symbol": "ZAPUP", "NativeStatuses": [{"Region": "L48", "Status": "N"}]}
    assert florida_status("Zamia integrifolia") == "native"
    assert usda["posts"][0][1]["MasterId"] == 15671
    assert usda["posts"][0][1]["Text"] == "ZAPUP"


def test_usda_result_is_cached(usda):
    florida_status("Hamelia patens")
    florida_status("  hamelia PATENS ")
    assert len(usda["gets"]) == 2


def test_usda_searches_without_author_or_variety(usda):
    florida_status("Hamelia patens Jacq. var. glabra")
    assert usda["gets"][0][1] == {"searchText": "Hamelia patens"}
