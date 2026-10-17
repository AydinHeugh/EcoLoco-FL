import csv
import io
import re

import requests

API = "https://plantsservices.sc.egov.usda.gov/api"
HEADERS = {"User-Agent": "EcoLoco-FL (https://github.com/AydinHeugh/EcoLoco-FL)"}
TIMEOUT = 6
TAG = re.compile(r"<[^>]+>")

_cache = {}


def _binomial(name):
    return " ".join(TAG.sub("", str(name)).lower().split()[:2])


def _get(route, params):
    response = requests.get(f"{API}/{route}", params=params, headers=HEADERS, timeout=TIMEOUT)
    response.raise_for_status()
    return response.json()


def _symbol(scientific_name):
    wanted = _binomial(scientific_name)
    for result in _get("PlantSearch", {"searchText": " ".join(scientific_name.split()[:2])}) or []:
        plant = result.get("Plant") or {}
        if _binomial(plant.get("ScientificName", "")) == wanted:
            return plant["Symbol"]
    return None


def _in_florida(profile):
    response = requests.post(
        f"{API}/PlantProfile/getDownloadDistributionDocumentation",
        json={"Field": "Symbol", "Text": profile["Symbol"], "SortBy": "sortSciName", "Offset": None, "MasterId": profile["Id"]},
        headers={**HEADERS, "Accept": "text/csv"},
        timeout=TIMEOUT,
    )
    response.raise_for_status()
    rows = csv.DictReader(io.StringIO(response.text.split("\n", 1)[1]))
    return any(row.get("State") == "Florida" for row in rows)


def florida_status(scientific_name):
    key = _binomial(scientific_name)
    if key in _cache:
        return _cache[key]
    symbol = _symbol(scientific_name)
    if symbol is None:
        result = None
    else:
        profile = _get("PlantProfile", {"symbol": symbol})
        lower48 = [s.get("Status", "") for s in profile.get("NativeStatuses") or [] if s.get("Region") == "L48"]
        native_in_us = any(status.startswith("N") for status in lower48)
        result = "native" if native_in_us and _in_florida(profile) else "introduced"
    _cache[key] = result
    return result
