import json
import logging
import math
import re
import threading
import time
from functools import cache
from pathlib import Path

import requests

log = logging.getLogger(__name__)

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
USER_AGENT = "EcoLoco-FL (https://github.com/AydinHeugh/EcoLoco-FL)"
NOMINATIM = "https://nominatim.openstreetmap.org"
INATURALIST = "https://api.inaturalist.org/v1/observations/species_counts"
REQUEST_TIMEOUT = (2, 3)
NOMINATIM_LOCK_TIMEOUT = 0.25
MAX_QUERY_LENGTH = 200
NEARBY_KM = 5
NEARBY_COUNT = 5
SOUTH_FLORIDA = {
    "Palm Beach", "Broward", "Miami-Dade", "Martin", "Monroe", "Collier",
    "Lee", "Hendry", "Glades", "Okeechobee", "St. Lucie", "Charlotte",
}

_lock = threading.Lock()
_last_call = [0.0]
_now = time.monotonic
_sleep = time.sleep


@cache
def _zip_counties():
    return json.loads((DATA_DIR / "fl_zip_counties.json").read_text(encoding="utf-8"))["zips"]


def county(zip_code):
    if not isinstance(zip_code, str) or not re.fullmatch(r"[0-9]{5}", zip_code.strip()):
        return None
    return _zip_counties().get(zip_code.strip())


def in_south_florida(zip_code):
    return county(zip_code) in SOUTH_FLORIDA


def round_coords(lat, lon):
    if isinstance(lat, bool) or isinstance(lon, bool):
        raise ValueError("latitude and longitude must be finite numbers")
    try:
        lat, lon = float(lat), float(lon)
    except (TypeError, ValueError, OverflowError):
        raise ValueError("latitude and longitude must be finite numbers") from None
    if not math.isfinite(lat) or not math.isfinite(lon):
        raise ValueError("latitude and longitude must be finite numbers")
    # Check the original values: rounding must not make an invalid point valid.
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        raise ValueError("latitude or longitude out of range")
    return round(lat, 2), round(lon, 2)


def _request_json(url, params):
    response = requests.get(url, params=params, headers={"User-Agent": USER_AGENT}, timeout=REQUEST_TIMEOUT)
    response.raise_for_status()
    return response.json()


def _plant_option(scientific_name, common_name):
    from services.fl_plants_service import plant_option

    return plant_option(scientific_name, common_name, 0.0, "")


def _nominatim(path, params):
    # Bound queueing as well as network time; a busy lookup can be retried later.
    if not _lock.acquire(timeout=NOMINATIM_LOCK_TIMEOUT):
        raise requests.Timeout("Location lookup is busy")
    try:
        # Nominatim's usage policy allows at most one request per second.
        wait = 1.0 - (_now() - _last_call[0])
        if wait > 0:
            _sleep(min(wait, 1.0))
        _last_call[0] = _now()
        return _request_json(f"{NOMINATIM}/{path}", {**params, "format": "json"})
    finally:
        _lock.release()


def _zip(address):
    if isinstance(address, dict) and address.get("country_code") not in (None, "us", "US"):
        return None
    postcode = address.get("postcode") if isinstance(address, dict) else None
    if not isinstance(postcode, str):
        return None
    postcode = postcode.strip()
    return postcode[:5] if re.fullmatch(r"[0-9]{5}(?:-[0-9]{4})?", postcode) else None


def _first_place(results):
    if not isinstance(results, list) or not results or not isinstance(results[0], dict):
        return None
    return results[0]


def geocode(query):
    if not isinstance(query, str) or not query.strip() or len(query) > MAX_QUERY_LENGTH:
        raise ValueError(f"location query must contain 1 to {MAX_QUERY_LENGTH} characters")
    try:
        place = _first_place(_nominatim("search", {
            "q": query.strip(), "countrycodes": "us", "limit": 1, "addressdetails": 1,
        }))
        if place is None:
            return None
        lat, lon = round_coords(place.get("lat"), place.get("lon"))
        return {"lat": lat, "lon": lon, "zip": _zip(place.get("address")) or reverse_zip(lat, lon)}
    except Exception as err:
        log.warning("Location lookup failed (%s)", type(err).__name__)
        return None


def zip_center(zip_code):
    if not isinstance(zip_code, str) or not re.fullmatch(r"[0-9]{5}", zip_code.strip()):
        return None
    try:
        place = _first_place(_nominatim("search", {"postalcode": zip_code.strip(), "countrycodes": "us", "limit": 1}))
        return round_coords(place.get("lat"), place.get("lon")) if place is not None else None
    except Exception as err:
        log.warning("ZIP lookup failed (%s)", type(err).__name__)
        return None


def reverse_zip(lat, lon):
    lat, lon = round_coords(lat, lon)
    try:
        result = _nominatim("reverse", {"lat": lat, "lon": lon, "zoom": 16})
        return _zip(result.get("address")) if isinstance(result, dict) else None
    except Exception as err:
        log.warning("Reverse location lookup failed (%s)", type(err).__name__)
        return None


def seen_near(lat, lon):
    lat, lon = round_coords(lat, lon)
    try:
        response = _request_json(INATURALIST, {
            "lat": lat, "lng": lon, "radius": NEARBY_KM, "quality_grade": "research",
            "iconic_taxa": "Plantae", "per_page": NEARBY_COUNT,
        })
        results = response.get("results") if isinstance(response, dict) else None
        if not isinstance(results, list):
            return []
    except Exception as err:
        log.warning("iNaturalist lookup failed (%s)", type(err).__name__)
        return []

    nearby = []
    for row in results[:NEARBY_COUNT]:
        if not isinstance(row, dict) or not isinstance(row.get("taxon"), dict):
            continue
        taxon = row["taxon"]
        name, common, count = taxon.get("name"), taxon.get("preferred_common_name"), row.get("count")
        if not isinstance(name, str) or not name.strip() or len(name) > 200:
            continue
        if type(count) is not int or count < 0:
            continue
        common = common.strip() if isinstance(common, str) and len(common) <= 200 else ""
        try:
            # Offline Florida evidence; nearby observations do not confirm the user's plant.
            found = _plant_option(name.strip(), common)
            if isinstance(found, dict):
                nearby.append({**found, "count": count, "needs_confirmation": True, "user_confirmed": False})
        except Exception as err:
            log.warning("Nearby plant evidence unavailable (%s)", type(err).__name__)
    return nearby
