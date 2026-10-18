import json
from functools import cache

from services.species_service import DATA_DIR

OPEN_LICENSES = {"cc0", "cc-by", "cc-by-nc", "cc-by-sa", "cc-by-nc-sa", "cc-by-nd", "cc-by-nc-nd"}


@cache
def _photos():
    path = DATA_DIR / "plant_photos.json"
    return json.loads(path.read_text(encoding="utf-8"))["photos"] if path.exists() else {}


def photo_for(scientific_name):
    return _photos().get(scientific_name or "")
