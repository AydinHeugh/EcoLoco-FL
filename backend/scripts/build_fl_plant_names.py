"""Build backend/data/fl_plant_names.json from the USDA PLANTS Florida state checklist.

Usage: python scripts/build_fl_plant_names.py <checklist CSV path, or "download"> <output json>
"""
import csv
import io
import json
import re
import sys
from pathlib import Path

import requests

DOWNLOAD = "https://plantsservices.sc.egov.usda.gov/api/plants-search-results/download"
FLORIDA = {"PlantLocationId": 3301, "PlantLocationName": "Florida", "PlantLocationCategory": "U.S. States", "countyName": None}
SOURCE = "USDA PLANTS Database, Florida state checklist (https://plants.usda.gov)"
RANKS = {"ssp.": "subsp.", "subsp.": "subsp.", "var.": "var."}
EPITHET = re.compile(r"^×?[a-z][a-z-]+$")


def _download():
    body = {"Locations": [FLORIDA], "FilterOptions": None, "UnfilteredPlantIds": None, "Offset": None,
            "SortBy": "sortSciName", "Type": "State", "TaxonSearchCriteria": None, "LocationFilters": None,
            "WetlandFilters": None, "MasterId": 0, "pageNumber": 0, "allData": 1, "selectedFilters": []}
    response = requests.post(DOWNLOAD, json=body, timeout=180, headers={
        "Accept": "text/csv", "User-Agent": "EcoLoco-FL (https://github.com/AydinHeugh/EcoLoco-FL)"})
    response.raise_for_status()
    return response.content.decode("utf-8-sig")


def clean_name(raw):
    tokens = raw.replace("×", " ×").replace("  ×", " ×").split()
    tokens = [t for t in tokens if t]
    if len(tokens) < 2 or not EPITHET.match(tokens[1]):
        return None
    name = [tokens[0], tokens[1]]
    for i, token in enumerate(tokens[2:], 2):
        if token in RANKS and i + 1 < len(tokens) and EPITHET.match(tokens[i + 1]):
            name += [RANKS[token], tokens[i + 1]]
            break
    return " ".join(name)


def plant_names(text):
    plants = {}
    for row in csv.DictReader(io.StringIO(text.split("\n", 1)[1])):
        name = clean_name(row["Scientific Name"])
        if row["Synonym"] or not name or name in plants:
            continue
        plants[name] = {"scientific_name": name, "common_name": (row["Common Name"] or "").strip()}
    return sorted(plants.values(), key=lambda e: e["scientific_name"].lower())


def main(source, out_path):
    text = _download() if source == "download" else Path(source).read_text(encoding="utf-8-sig")
    plants = plant_names(text)
    result = {"source": SOURCE, "plants": plants}
    Path(out_path).write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"{len(plants)} Florida plants")


if __name__ == "__main__":
    main(*sys.argv[1:3])
