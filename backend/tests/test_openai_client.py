import importlib
from types import SimpleNamespace

import pytest

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


def _raising_client(error):
    def create(**kwargs):
        raise error
    return SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))


def test_chat_raises_ai_unavailable_on_client_error(monkeypatch):
    monkeypatch.setattr(openai_client, "_client", lambda: _raising_client(RuntimeError("429 insufficient_quota")))
    with pytest.raises(openai_client.AIUnavailable):
        openai_client.chat("hi")


def test_chat_raises_ai_unavailable_when_client_cannot_be_created(monkeypatch):
    def no_client():
        raise RuntimeError("Missing credentials")
    monkeypatch.setattr(openai_client, "_client", no_client)
    with pytest.raises(openai_client.AIUnavailable):
        openai_client.chat("hi")


def test_chat_bad_json_raises_ai_unavailable(monkeypatch):
    monkeypatch.setattr(openai_client, "_client", lambda: _fake_client("Sorry, I can't help with that."))
    with pytest.raises(openai_client.AIUnavailable):
        openai_client.chat("hi", json_reply=True)


def test_chat_sends_system_message_first(monkeypatch):
    sent = {}

    class Completions:
        def create(self, **kwargs):
            sent.update(kwargs)
            return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content="ok"))])

    monkeypatch.setattr(openai_client, "_client", lambda: SimpleNamespace(chat=SimpleNamespace(completions=Completions())))
    assert openai_client.chat("hi", system="be plain") == "ok"
    assert sent["messages"] == [{"role": "system", "content": "be plain"}, {"role": "user", "content": "hi"}]
