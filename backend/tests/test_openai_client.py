import importlib
from types import SimpleNamespace

from services import openai_client


def _fake_client(reply):
    create = lambda **kwargs: SimpleNamespace(
        choices=[SimpleNamespace(message=SimpleNamespace(content=reply))])
    return SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))


def test_chat_returns_trimmed_text(monkeypatch):
    monkeypatch.setattr(openai_client, "_client", lambda: _fake_client("  Hello.  \n"))
    assert openai_client.chat("hi") == "Hello."


def test_chat_parses_json_inside_code_fences(monkeypatch):
    monkeypatch.setattr(openai_client, "_client", lambda: _fake_client('```json\n{"a": [1, 2]}\n```'))
    assert openai_client.chat("hi", json_reply=True) == {"a": [1, 2]}


def test_chat_parses_bare_json(monkeypatch):
    monkeypatch.setattr(openai_client, "_client", lambda: _fake_client('[{"a": 1}]'))
    assert openai_client.chat("hi", json_reply=True) == [{"a": 1}]


def test_import_needs_no_api_key(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    importlib.reload(openai_client)  # must not raise
