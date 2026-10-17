from pathlib import Path

import pytest

FRONTEND = Path(__file__).resolve().parents[2] / "frontend"
FILES = sorted(FRONTEND.rglob("*.js"))


@pytest.mark.parametrize("path", FILES, ids=lambda p: p.name)
@pytest.mark.parametrize("phrase", ["PROBLEM", "Unknown Wildlife", "Unknown wildlife", "wildlife support"])
def test_old_ai_labels_are_gone(path, phrase):
    assert phrase not in path.read_text(encoding="utf-8")


def test_offline_banner_text_is_exact():
    text = (FRONTEND / "components" / "OfflineNotice.js").read_text(encoding="utf-8")
    assert "Extra descriptions are offline. Plant names and Florida status still work." in text
