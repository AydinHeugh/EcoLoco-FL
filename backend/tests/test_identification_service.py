import pytest

from services import openai_client
from services.identification_service import identify_species


@pytest.fixture
def model_reply(monkeypatch):
    reply = {"value": {}, "sent": None}

    def fake_chat(content, json_reply=False):
        reply["sent"] = content
        return reply["value"]

    monkeypatch.setattr(openai_client, "chat", fake_chat)
    return reply


def test_identify_species_returns_standard_shape(model_reply):
    model_reply["value"] = {
        "scientific_name": "Zamia integrifolia", "common_name": "Coontie", "confidence": 0.87,
        "candidates": [{"scientific_name": "Zamia furfuracea", "common_name": "Cardboard palm", "confidence": 0.1}],
    }
    assert identify_species("abc123", "33139") == {
        "scientific_name": "Zamia integrifolia", "common_name": "Coontie", "confidence": 0.87,
        "candidates": [{"scientific_name": "Zamia furfuracea", "common_name": "Cardboard palm", "confidence": 0.1}],
    }


def test_identify_species_cleans_messy_reply(model_reply):
    model_reply["value"] = {"scientific_name": "  Zamia integrifolia ", "common_name": "Coontie",
                            "confidence": "0.871", "candidates": ["junk", {"common_name": "Other"}]}
    result = identify_species("abc123", "33139")
    assert result["scientific_name"] == "Zamia integrifolia"
    assert result["confidence"] == 0.87
    assert result["candidates"] == [{"scientific_name": "", "common_name": "Other", "confidence": 0.0}]


def test_identify_species_survives_missing_fields(model_reply):
    model_reply["value"] = {"common_name": "Mystery plant"}
    assert identify_species("abc123", "33139") == {
        "scientific_name": "", "common_name": "Mystery plant", "confidence": 0.0, "candidates": []}


@pytest.mark.parametrize("value, expected", [(1.7, 1.0), (-0.2, 0.0), ("abc", 0.0), (None, 0.0)])
def test_confidence_is_clamped(model_reply, value, expected):
    model_reply["value"] = {"scientific_name": "X y", "common_name": "X", "confidence": value}
    assert identify_species("abc123", "33139")["confidence"] == expected


@pytest.mark.parametrize("image, url", [
    ("abc123", "data:image/jpeg;base64,abc123"),
    ("data:image/png;base64,xyz", "data:image/png;base64,xyz"),
    ("https://example.com/p.jpg", "https://example.com/p.jpg"),
])
def test_image_is_sent_as_url(model_reply, image, url):
    identify_species(image, "33139")
    assert model_reply["sent"][0]["image_url"]["url"] == url
    assert "33139" in model_reply["sent"][1]["text"]
