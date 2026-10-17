"""Build backend/data/fisc_list.json from the official FISC plant list PDF.

Usage: python scripts/build_fisc_list.py <pdf path or URL> <output json>
"""
import json
import re
import sys
import tempfile
from pathlib import Path

import requests

FOOTNOTE = re.compile(r"[\d*†‡]+(?=\s|$)")
ZONE = re.compile(r"\b[NCS]\b")
SYNONYM = re.compile(r"\(=\s*([^)]+)\)")


def clean_name(raw):
    text = " ".join(raw.split())
    match = SYNONYM.search(text)
    if match:
        text = text[:match.start()] + text[match.end():]
    name = " ".join(FOOTNOTE.sub("", text).split())
    if not match:
        return name, []
    inner = " ".join(FOOTNOTE.sub("", match.group(1)).split())
    genus, *rest = name.split()
    if " " in inner:
        synonym = inner
    elif inner[0].islower():
        synonym = " ".join([genus, inner, *rest[1:]])
    else:
        synonym = " ".join([inner, *rest])
    return name, [synonym]


def _bands(edges, x0, x1):
    ys = sorted(e["top"] for e in edges if e["orientation"] == "h" and e["x0"] < x1 and e["x1"] > x0)
    merged = []
    for y in ys:
        if not merged or y - merged[-1] > 1.0:
            merged.append(y)
    return list(zip(merged, merged[1:]))


def _reading_order(words):
    lines = []
    for word in sorted(words, key=lambda w: w["top"]):
        if lines and abs(word["top"] - lines[-1][0]["top"]) <= 2:
            lines[-1].append(word)
        else:
            lines.append([word])
    return [w for line in lines for w in sorted(line, key=lambda w: w["x0"])]


def _side_entries(page, words, edges, columns, category, top, bottom):
    sci_x, common_x, zone_x, end_x = columns
    side = [w for w in words if sci_x - 3 <= w["x0"] < end_x - 3 and top < w["top"] < bottom]
    entries = []
    for y0, y1 in _bands(edges, sci_x, common_x):
        cell = _reading_order(w for w in side if y0 <= (w["top"] + w["bottom"]) / 2 < y1)
        sci = " ".join(w["text"] for w in cell if w["x0"] < common_x - 3)
        common = " ".join(w["text"] for w in cell if common_x - 3 <= w["x0"] < zone_x - 3)
        zones = ZONE.findall(" ".join(w["text"] for w in cell if w["x0"] >= zone_x - 3))
        if not sci or not zones:
            continue
        name, synonyms = clean_name(sci)
        entries.append({
            "scientific_name": name,
            "common_name": common.replace("’", "'").split(";")[0].strip(),
            "synonyms": synonyms,
            "fisc_category": category,
            "zones": ", ".join(zones),
        })
    return entries


def parse_pdf(path):
    import pdfplumber

    entries = []
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ""
            if "FISC Category II" in text:
                category = "II"
            elif "FISC Category I" in text:
                category = "I"
            else:
                continue
            words = page.extract_words()
            header_top = min(w["top"] for w in words if w["text"].startswith("Scientific"))
            row = [w for w in words if abs(w["top"] - header_top) <= 3]
            headers = sorted((w for w in row if w["text"].startswith("Scientific")), key=lambda w: w["x0"])
            commons = sorted((w for w in row if w["text"] == "Common"), key=lambda w: w["x0"])
            zones = sorted((w for w in row if w["text"].startswith("Zone")), key=lambda w: w["x0"])
            top = max(w["bottom"] for w in headers)
            for i in range(len(headers)):
                end_x = headers[i + 1]["x0"] if i + 1 < len(headers) else page.width
                columns = (headers[i]["x0"], commons[i]["x0"], zones[i]["x0"], end_x)
                entries += _side_entries(page, words, page.edges, columns, category, top, page.height)
    return entries


def _names(entry):
    return {n.lower() for n in [entry["scientific_name"], *entry.get("synonyms", [])]}


def merge(official, curated):
    merged, used = [], set()
    for entry in official:
        entry = {**entry, "why": None}
        for i, cur in enumerate(curated):
            if _names(entry) & _names(cur):
                extra = [n for n in [cur["scientific_name"], *cur.get("synonyms", [])]
                         if n.lower() != entry["scientific_name"].lower() and n not in entry["synonyms"]]
                entry["synonyms"] = entry["synonyms"] + extra
                entry["why"] = cur["why"]
                used.add(i)
                break
        merged.append(entry)
    unmatched = [cur["scientific_name"] for i, cur in enumerate(curated) if i not in used]
    return merged, unmatched


def _pdf_path(source):
    if not source.startswith(("http://", "https://")):
        return source
    response = requests.get(source, timeout=60, headers={"User-Agent": "EcoLoco-FL (https://github.com/AydinHeugh/EcoLoco-FL)"})
    response.raise_for_status()
    tmp = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
    tmp.write(response.content)
    tmp.close()
    return tmp.name


def main(source, out_path):
    out = Path(out_path)
    current = json.loads(out.read_text(encoding="utf-8")) if out.exists() else {"species": []}
    official = parse_pdf(_pdf_path(source))
    merged, unmatched = merge(official, current["species"])
    result = {
        "_comment": (
            "Generated by backend/scripts/build_fisc_list.py from the official FISC 2026 Plant List "
            "(Category I and II). 'why' lines are curated by EcoLoco for common species and null otherwise; "
            "verify them against FISC and UF/IFAS before relying on them. Synonyms include older names a model may return."
        ),
        "source": source,
        "species": merged,
    }
    out.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"{len(merged)} species ({sum(e['fisc_category'] == 'I' for e in merged)} Cat I, "
          f"{sum(e['fisc_category'] == 'II' for e in merged)} Cat II); "
          f"{sum(1 for e in merged if e['why'])} with curated 'why' lines")
    if unmatched:
        print("Curated species not on the official list (dropped):", ", ".join(unmatched))


if __name__ == "__main__":
    main(*sys.argv[1:3])
