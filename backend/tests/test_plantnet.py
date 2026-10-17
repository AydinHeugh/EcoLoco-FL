import base64

import pytest
import requests

from services.identification_service import identify_with_plantnet

JPEG = b"\xff\xd8\xff\xe0fake-jpeg"
PNG = b"\x89PNG\r\n\x1a\nfake-png"


def b64(data):
    return base64.b64encode(data).decode()


def plantnet_result(name, common, score):
    return {
        "score": score,
        "species": {
            "scientificNameWithoutAuthor": name,
            "scientificNameAuthorship": "L.",
            "scientificName": f"{name} L.",
            "commonNames": [common] if common else [],
        },
    }


class FakeResponse:
    def __init__(self, status_code=200, body=None):
        self.status_code = status_code
        self._body = body if body is not None else {"results": []}

    def raise_for_status(self):
        if self.status_code >= 400:
            raise requests.HTTPError(f"{self.status_code} error", response=self)

    def json(self):
        return self._body


@pytest.fixture
def plantnet(monkeypatch):
    monkeypatch.setenv("PLANTNET_API_KEY", "test-key")
    calls = {"post": [], "response": FakeResponse(body={"results": [plantnet_result("Zamia integrifolia", "Coontie", 0.9)]})}

    def fake_post(url, **kwargs):
        calls["post"].append({"url": url, **kwargs})
        return calls["response"]

    monkeypatch.setattr(requests, "post", fake_post)
    return calls


def test_plantnet_request_matches_api(plantnet):
    identify_with_plantnet([b64(JPEG), b64(JPEG + b"2")])
    call = plantnet["post"][0]
    assert call["url"] == "https://my-api.plantnet.org/v2/identify/all"
    assert call["params"] == {"api-key": "test-key", "nb-results": 5, "lang": "en"}
    assert [f[0] for f in call["files"]] == ["images", "images"]
    assert call["files"][0][1][1] == JPEG
    assert call["files"][1][1][1] == JPEG + b"2"
    assert call["files"][0][1][2] == "image/jpeg"
    assert call["timeout"] == (3, 12)


def test_plantnet_parses_ranked_results(plantnet):
    plantnet["response"] = FakeResponse(body={"results": [
        plantnet_result("Zamia integrifolia", "Coontie", 0.8312),
        plantnet_result("Zamia furfuracea", None, 0.0921),
    ]})
    assert identify_with_plantnet([b64(JPEG)]) == [
        {"scientific_name": "Zamia integrifolia", "common_name": "Coontie", "confidence": 0.83},
        {"scientific_name": "Zamia furfuracea", "common_name": "", "confidence": 0.09},
    ]


def test_plantnet_detects_png(plantnet):
    identify_with_plantnet([b64(PNG)])
    assert plantnet["post"][0]["files"][0][1][2] == "image/png"


def test_plantnet_accepts_data_url(plantnet):
    identify_with_plantnet([f"data:image/jpeg;base64,{b64(JPEG)}"])
    assert plantnet["post"][0]["files"][0][1][1] == JPEG


def test_plantnet_remote_urls_never_fetch(plantnet, monkeypatch):
    def forbidden(*args, **kwargs):
        pytest.fail("Remote image URLs must never be fetched")
    monkeypatch.setattr(requests, "get", forbidden)
    with pytest.raises(ValueError):
        identify_with_plantnet(["http://127.0.0.1/internal"])
    assert plantnet["post"] == []


def test_plantnet_malformed_candidates_are_filtered_and_ranked(plantnet):
    plantnet["response"] = FakeResponse(body={"results": [
        None, {}, {"species": None},
        plantnet_result("Low first", None, 0.2),
        plantnet_result("Zamia integrifolia", "Coontie", 0.9),
        plantnet_result("Zamia integrifolia", "Duplicate", 0.8),
    ]})
    result = identify_with_plantnet([b64(JPEG)])
    assert [r["scientific_name"] for r in result] == ["Zamia integrifolia", "Low first"]


def test_plantnet_rejects_non_jpeg_png(plantnet):
    with pytest.raises(ValueError):
        identify_with_plantnet([b64(b"RIFF....WEBPfake")])
    assert plantnet["post"] == []


def test_plantnet_without_key_raises(monkeypatch):
    monkeypatch.delenv("PLANTNET_API_KEY", raising=False)
    with pytest.raises(RuntimeError, match="PLANTNET_API_KEY"):
        identify_with_plantnet([b64(JPEG)])


def test_plantnet_http_error_raises(plantnet):
    plantnet["response"] = FakeResponse(status_code=401, body={"statusCode": 401, "message": "Bad token"})
    with pytest.raises(requests.HTTPError):
        identify_with_plantnet([b64(JPEG)])
