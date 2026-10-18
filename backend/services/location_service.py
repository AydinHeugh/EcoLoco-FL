import json
import logging
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from functools import cache

import requests

from services.fl_plants_service import plant_option
from services.species_service import DATA_DIR

log = logging.getLogger(__name__)

USER_AGENT = "EcoLoco-FL (https://github.com/AydinHeugh/EcoLoco-FL)"
NOMINATIM = "https://nominatim.openstreetmap.org"
INATURALIST = "https://api.inaturalist.org/v1/observations/species_counts"
NEARBY_KM = 5
NEARBY_COUNT = 5
PLANTING_COUNTIES = {"Palm Beach"}

_lock = threading.Lock()
_last_call = [0.0]
_now = time.monotonic
_sleep = time.sleep


@cache
def _zip_counties():
    return json.loads((DATA_DIR / "fl_zip_counties.json").read_text(encoding="utf-8"))["zips"]


def county(zip_code):
    return _zip_counties().get(zip_code)


def plantings_checked(zip_code):
    return county(zip_code) in PLANTING_COUNTIES


def round_coords(lat, lon):
    try:
        lat, lon = round(float(lat), 2), round(float(lon), 2)
    except (TypeError, ValueError):
        raise ValueError("latitude and longitude must be numbers")
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        raise ValueError("latitude or longitude out of range")
    return lat, lon


def _nominatim(path, params):
    # Nominatim's usage policy allows at most one request per second.
    with _lock:
        wait = 1.0 - (_now() - _last_call[0])
        if wait > 0:
            _sleep(wait)
        _last_call[0] = _now()
        response = requests.get(f"{NOMINATIM}/{path}", params={**params, "format": "json"},
                                headers={"User-Agent": USER_AGENT}, timeout=15)
    response.raise_for_status()
    return response.json()


def _zip(address):
    postcode = str((address or {}).get("postcode") or "")[:5]
    return postcode if postcode.isdigit() and len(postcode) == 5 else None


def geocode(query):
    results = _nominatim("search", {"q": query, "countrycodes": "us", "limit": 1, "addressdetails": 1})
    if not results:
        return None
    lat, lon = round_coords(results[0]["lat"], results[0]["lon"])
    return {"lat": lat, "lon": lon, "zip": _zip(results[0].get("address")) or reverse_zip(lat, lon)}


def zip_center(zip_code):
    try:
        results = _nominatim("search", {"postalcode": zip_code, "countrycodes": "us", "limit": 1})
    except Exception as err:
        log.warning("ZIP lookup failed (%s)", type(err).__name__)
        return None
    return round_coords(results[0]["lat"], results[0]["lon"]) if results else None


def reverse_zip(lat, lon):
    lat, lon = round_coords(lat, lon)
    return _zip(_nominatim("reverse", {"lat": lat, "lon": lon, "zoom": 16}).get("address"))


def seen_near(lat, lon):
    lat, lon = round_coords(lat, lon)
    try:
        response = requests.get(INATURALIST, params={
            "lat": lat, "lng": lon, "radius": NEARBY_KM, "quality_grade": "research",
            "iconic_taxa": "Plantae", "per_page": NEARBY_COUNT,
        }, headers={"User-Agent": USER_AGENT}, timeout=15)
        response.raise_for_status()
        results = response.json().get("results", [])[:NEARBY_COUNT]
    except Exception as err:
        log.warning("iNaturalist lookup failed (%s)", type(err).__name__)
        return []

    def option(row):
        taxon = row.get("taxon") or {}
        found = plant_option(taxon.get("name", ""), (taxon.get("preferred_common_name") or "").capitalize(), 0.0, "")
        return {**found, "count": row.get("count", 0)}

    with ThreadPoolExecutor(max_workers=NEARBY_COUNT) as pool:
        return list(pool.map(option, results))
