import pytest
import requests


@pytest.fixture(autouse=True)
def no_network(monkeypatch):
    def blocked(*args, **kwargs):
        raise RuntimeError("network blocked in tests")

    monkeypatch.delenv("PLANTNET_API_KEY", raising=False)
    monkeypatch.setattr(requests, "post", blocked)
    monkeypatch.setattr(requests, "get", blocked)
