"""Build data/plant_photos.json: one openly licensed iNaturalist photo per plant in our lists.

Usage: python scripts/build_plant_photos.py data/plant_photos.json
Plants already in the file are kept; only missing ones are looked up.
"""
import json
import sys
import time
from pathlib import Path

import requests

DATA = Path(__file__).resolve().parents[1] / "data"
TAXA = "https://api.inaturalist.org/v1/taxa"
USER_AGENT = "EcoLoco-FL (https://github.com/AydinHeugh/EcoLoco-FL)"
OPEN_LICENSES = {"cc0", "cc-by", "cc-by-nc", "cc-by-sa", "cc-by-nc-sa", "cc-by-nd", "cc-by-nc-nd"}
LISTS = ("fl_recommendations.json", "fisc_list.json", "fl_natives.json", "fl_non_natives.json")


def species_name(name):
    return " ".join(name.split()[:2]).lower()


def get(url, **params):
    response = requests.get(url, params=params, headers={"User-Agent": USER_AGENT}, timeout=20)
    response.raise_for_status()
    return response.json().get("results", [])


def open_photo(photo):
    if photo and photo.get("license_code") in OPEN_LICENSES and photo.get("medium_url"):
        return {"url": photo["medium_url"], "credit": photo.get("attribution", ""), "license": photo["license_code"]}
    return None


def find_photo(name):
    for taxon in get(TAXA, q=name, per_page=5):
        if species_name(taxon.get("name", "")) != species_name(name):
            continue
        found = open_photo(taxon.get("default_photo"))
        if found:
            return found
        time.sleep(1)
        for full in get(f"{TAXA}/{taxon['id']}"):
            for item in full.get("taxon_photos", []):
                found = open_photo(item.get("photo"))
                if found:
                    return found
        return None
    return None


def main(out):
    names = []
    for list_name in LISTS:
        for entry in json.loads((DATA / list_name).read_text(encoding="utf-8"))["species"]:
            if entry["scientific_name"] not in names:
                names.append(entry["scientific_name"])
    old = json.loads(Path(out).read_text(encoding="utf-8"))["photos"] if Path(out).exists() else {}
    photos, missing = {}, []
    for name in names:
        if name in old:
            photos[name] = old[name]
            continue
        try:
            found = find_photo(name)
        except requests.RequestException as err:
            print(f"{name}: {type(err).__name__}")
            found = None
        if found:
            photos[name] = found
        else:
            missing.append(name)
        time.sleep(1)
    Path(out).write_text(json.dumps({
        "_comment": "One openly licensed iNaturalist photo per plant, with its credit. Built by scripts/build_plant_photos.py.",
        "photos": photos,
    }, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"{len(photos)} photos, {len(missing)} without an open photo: {', '.join(missing)}")


if __name__ == "__main__":
    main(sys.argv[1])
