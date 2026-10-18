import pytest

from services import location_service, photo_service, plan_service
from services.plan_service import build_plan
from services.summary_service import summarize

PHOTO = {"url": "https://example.org/coontie.jpg", "credit": "(c) Someone, some rights reserved (CC BY-NC)", "license": "cc-by-nc"}


@pytest.fixture(autouse=True)
def photos(monkeypatch):
    monkeypatch.setattr(photo_service, "_photos", lambda: {"Zamia integrifolia": PHOTO, "Schinus terebinthifolia": PHOTO})


def test_photo_for_known_and_unknown_plants():
    assert photo_service.photo_for("Zamia integrifolia") == PHOTO
    assert photo_service.photo_for("Welwitschia mirabilis") is None
    assert photo_service.photo_for("") is None


def test_campus_plants_carry_their_photo():
    plants = summarize([{"scientific_name": "Coontie"}, {"scientific_name": ""}])["plants"]
    assert plants[0]["photo"] == PHOTO
    assert plants[1]["photo"] is None


def test_plan_cards_carry_photos(monkeypatch):
    every = plan_service._recommendations()
    monkeypatch.setattr(plan_service, "_recommendations", lambda: [dict(e, verified=True) for e in every
                                                                   if e["scientific_name"] == "Zamia integrifolia"])
    plan = build_plan([{"scientific_name": "Schinus terebinthifolius"}])
    assert plan["remove"][0]["photo"] == PHOTO
    assert plan["add"][0]["photo"] == PHOTO


def test_nearby_uses_the_inaturalist_photo_when_openly_licensed(monkeypatch):
    rows = [
        {"count": 9, "taxon": {"name": "Zamia integrifolia", "preferred_common_name": "coontie",
                               "default_photo": {"medium_url": "https://example.org/inat.jpg", "attribution": "(c) A", "license_code": "cc-by"}}},
        {"count": 4, "taxon": {"name": "Schinus terebinthifolia", "preferred_common_name": "Brazilian peppertree",
                               "default_photo": {"medium_url": "https://example.org/closed.jpg", "attribution": "(c) B", "license_code": None}}},
    ]

    class Reply:
        def raise_for_status(self): pass
        def json(self): return {"results": rows}

    monkeypatch.setattr(location_service.requests, "get", lambda *a, **k: Reply())
    found = location_service.seen_near(26.37, -80.1)
    assert found[0]["photo"] == {"url": "https://example.org/inat.jpg", "credit": "(c) A", "license": "cc-by"}
    assert found[1]["photo"] == PHOTO
