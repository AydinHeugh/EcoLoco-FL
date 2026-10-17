"""Optional USDA distribution evidence, never a Florida-nativity inference.

USDA's L48 native-status region covers the lower 48 states. A plant can be
native somewhere in that region and introduced in Florida. A distribution
record establishes recorded occurrence only, not local native status.
"""

import copy
import csv
import io
import time
from collections import OrderedDict

import requests

from services.fl_plants_service import _normalize

API = "https://plantsservices.sc.egov.usda.gov/api"
HEADERS = {"User-Agent": "EcoLoco-FL (https://github.com/AydinHeugh/EcoLoco-FL)"}
TIMEOUT = 4
CACHE_SECONDS = 24 * 60 * 60
CACHE_SIZE = 256
_cache = OrderedDict()


def _get(route, params):
    response = requests.get(f"{API}/{route}", params=params, headers=HEADERS, timeout=TIMEOUT)
    response.raise_for_status()
    return response.json()


def _symbol(scientific_name):
    wanted = _normalize(scientific_name)
    # Search broadly, then require the exact rank-aware identity. A species
    # result cannot stand in for a requested variety or hybrid.
    search = " ".join(str(scientific_name).split()[:2])
    results = _get("PlantSearch", {"searchText": search})
    if not isinstance(results, list):
        return None
    for result in results:
        plant = result.get("Plant") if isinstance(result, dict) else None
        if isinstance(plant, dict) and _normalize(plant.get("ScientificName")) == wanted:
            return plant.get("Symbol")
    return None


def _in_florida(profile):
    if not profile.get("Symbol") or profile.get("Id") is None:
        return None
    response = requests.post(
        f"{API}/PlantProfile/getDownloadDistributionDocumentation",
        json={"Field": "Symbol", "Text": profile["Symbol"], "SortBy": "sortSciName", "Offset": None, "MasterId": profile["Id"]},
        headers={**HEADERS, "Accept": "text/csv"},
        timeout=TIMEOUT,
    )
    response.raise_for_status()
    # The export normally has a title line before the actual CSV header.
    # Find the header instead of treating a missing or changed export as absence.
    lines = response.text.lstrip("\ufeff").splitlines()
    for index, line in enumerate(lines):
        header = next(csv.reader([line]), [])
        if "State" not in header or "Symbol" not in header:
            continue
        rows = list(csv.DictReader(io.StringIO("\n".join(lines[index:]))))
        if not rows:
            return None
        return any(row.get("State", "").strip().lower() == "florida" for row in rows)
    return None


def florida_distribution(scientific_name):
    """Return bounded, cached occurrence metadata; provider errors propagate.

    False means no Florida record in this export, not absence from the state.
    Missing or malformed exports stay unknown rather than becoming false.
    """
    key = _normalize(scientific_name)
    if not key:
        return None
    now = time.monotonic()
    cached = _cache.get(key)
    if cached and now - cached[0] < CACHE_SECONDS:
        return copy.deepcopy(cached[1])
    symbol = _symbol(scientific_name)
    result = None
    if symbol:
        profile = _get("PlantProfile", {"symbol": symbol})
        if isinstance(profile, dict):
            statuses = profile.get("NativeStatuses") or []
            result = {
                "symbol": profile.get("Symbol", symbol),
                "florida_recorded": _in_florida(profile),
                "lower48_statuses": [entry.get("Status") for entry in statuses if isinstance(entry, dict) and entry.get("Region") == "L48"],
                "florida_native_status": None,
                "source_url": f"https://plants.sc.egov.usda.gov/plant-profile/{profile.get('Symbol', symbol)}",
                "limitation": "USDA L48 native status and Florida occurrence do not establish Florida nativity.",
            }
    _cache[key] = (now, copy.deepcopy(result))
    _cache.move_to_end(key)
    while len(_cache) > CACHE_SIZE:
        _cache.popitem(last=False)
    return result


def florida_status(scientific_name):
    """Compatibility guard: these USDA endpoints cannot verify state nativity.

    Use florida_distribution explicitly when distribution evidence is useful;
    classification uses the sourced local catalog and never waits on USDA.
    """
    return None
