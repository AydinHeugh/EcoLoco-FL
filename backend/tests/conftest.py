import pytest
import requests

from services import openai_client


@pytest.fixture(autouse=True)
def no_network(monkeypatch):
    def blocked(*args, **kwargs):
        raise RuntimeError("network blocked in tests")

    def ai_blocked(*args, **kwargs):
        raise RuntimeError("OpenAI blocked in tests")

    monkeypatch.delenv("PLANTNET_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.setattr(requests, "post", blocked)
    monkeypatch.setattr(requests, "get", blocked)
    monkeypatch.setattr(openai_client, "_client", ai_blocked)
