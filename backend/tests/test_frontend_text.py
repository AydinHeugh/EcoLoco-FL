import re
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


BANNED = ["pruning", "host plant", "keystone", "lepidoptera", "cultivar", "established", "category i",
          "propagate", "biodiversity score", "botanist", "prioritise", "personalise", "ecological benefit"]
DATA = Path(__file__).resolve().parents[1] / "data"


def _data_texts():
    import json
    load = lambda name: json.loads((DATA / name).read_text(encoding="utf-8"))
    for name in ("fisc_list.json", "fl_natives.json", "fl_non_natives.json"):
        for entry in load(name)["species"]:
            yield f"{name}:{entry['scientific_name']}", entry.get("why") or ""
    for line in load("why_this_matters.json")["lines"]:
        yield "why_this_matters", line["text"]


@pytest.mark.parametrize("path", FILES, ids=lambda p: p.name)
def test_frontend_has_no_jargon(path):
    text = re.sub(r"https?://\S+", "", path.read_text(encoding="utf-8")).lower()
    assert [w for w in BANNED if w in text] == []


def test_data_has_no_jargon():
    found = [(where, w) for where, text in _data_texts() for w in BANNED if w in text.lower()]
    assert found == []


def test_letter_template_has_no_jargon():
    from services import ai_service
    empty = {"remove": [], "add": [], "gaps": [], "summary": {"percent_native": 50, "percent_native_with_plan": 75}}
    text = ai_service.letter_facts(empty, "33496").lower()
    assert [w for w in BANNED if w in text] == []


@pytest.mark.parametrize("swap", ["trimming", "caterpillars eat its leaves", "one of the most important plants for wildlife here",
                                  "butterflies and moths", "a different version sold in stores", "after its first year",
                                  "officially listed as invasive in Florida"])
def test_letter_prompt_lists_the_word_swaps(swap):
    from services import ai_service
    assert swap in ai_service.LETTER_SYSTEM


@pytest.mark.parametrize("path", FILES, ids=lambda p: p.name)
@pytest.mark.parametrize("phrase", ["PlantNet: {", "PlantNet match", "Non-native (not harmful)"])
def test_scores_name_their_real_source(path, phrase):
    assert phrase not in path.read_text(encoding="utf-8")


def test_match_label_names_openai_for_fallback_scores():
    text = (FRONTEND / "components" / "CandidatePicker.js").read_text(encoding="utf-8")
    assert "openai_fallback" in text and "'OpenAI'" in text and "'PlantNet'" in text


def test_ecoscan_asks_for_real_outdoor_plants():
    assert "Only scan real plants growing outdoors." in (FRONTEND / "screens" / "AuditScreen.js").read_text(encoding="utf-8")


def test_unchecked_area_message_is_exact():
    text = (FRONTEND / "components" / "PlanCard.js").read_text(encoding="utf-8")
    assert "'Planting recommendations are only checked for Palm Beach County so far.'" in text


def test_atlas_button_opens_in_app_browser_only_with_a_link():
    text = (FRONTEND / "components" / "AtlasButton.js").read_text(encoding="utf-8")
    assert "WebBrowser.openBrowserAsync(url)" in text
    assert "if (!url) return null;" in text
    assert "See where it grows" in text
    for screen in ("components/PlanCard.js", "screens/IdentificationScreen.js"):
        assert "<AtlasButton url=" in (FRONTEND / screen).read_text(encoding="utf-8")


def test_results_list_has_a_remove_button_that_rebuilds_the_plan():
    text = (FRONTEND / "screens" / "AuditResultsScreen.js").read_text(encoding="utf-8")
    assert "onPress={() => removePlant(i)}" in text
    assert "}, [request, attempt]);" in text


def test_ecoscan_uses_plant_cards_with_scan_all():
    text = (FRONTEND / "screens" / "AuditScreen.js").read_text(encoding="utf-8")
    for phrase in ("Add plant", "Scan all (", "Scan this plant", "Photos of this one plant:", "Take photo", "Upload photos"):
        assert phrase in text


def test_picker_shows_openai_pick_and_agreement():
    text = (FRONTEND / "components" / "CandidatePicker.js").read_text(encoding="utf-8")
    assert "OpenAI's pick" in text
    assert "It's one of these:" in text
    assert "Best guess" not in text


def test_add_cards_can_leave_the_letter():
    text = (FRONTEND / "components" / "PlanCard.js").read_text(encoding="utf-8")
    assert "In my letter" in text
    assert "skip" in (FRONTEND / "services" / "geminiService.js").read_text(encoding="utf-8")


def test_choose_by_name_never_shows_a_status_in_the_list():
    picker = (FRONTEND / "components" / "NamePicker.js").read_text(encoding="utf-8")
    assert "searchNames(text)" in picker
    assert "StatusBadge" not in picker and "status" not in picker.replace("Florida status is checked", "")
    for screen in ("AuditScreen.js", "IdentificationScreen.js"):
        text = (FRONTEND / "screens" / screen).read_text(encoding="utf-8")
        assert "Know its name? Choose by name" in text
        assert "choosePlant(" in text


def test_chosen_plants_say_so_instead_of_a_percent():
    picker = (FRONTEND / "components" / "CandidatePicker.js").read_text(encoding="utf-8")
    assert "export const CHOSEN_BY_NAME = 'Chosen by name';" in picker
    assert "if (idSource === 'by_name') return CHOSEN_BY_NAME;" in picker


def test_site_filters_are_on_both_planting_screens():
    filters = (FRONTEND / "components" / "SiteFilters.js").read_text(encoding="utf-8")
    for label in ("Light", "Moisture", "Space", "Care", "Any"):
        assert f"'{label}'" in filters or f'"{label}"' in filters
    for screen in ("RecommendationScreen.js", "AuditResultsScreen.js"):
        assert "<SiteFilters" in (FRONTEND / "screens" / screen).read_text(encoding="utf-8")


def test_openai_pick_shows_no_number():
    picker = (FRONTEND / "components" / "CandidatePicker.js").read_text(encoding="utf-8")
    assert "\" · OpenAI's pick\"" in picker
    assert "sure)" not in picker and "suggestedConfidence" not in picker


def test_home_page_says_what_the_app_does():
    text = (FRONTEND / "screens" / "HomeScreen.js").read_text(encoding="utf-8")
    for phrase in ("Find out which plants on your campus help Florida wildlife, and which ones hurt it.",
                   "Start a campus scan", "Write to Your Principal", "How We Know",
                   "Every answer comes from Florida's official invasive list, USDA, and the USF Atlas. Our team checked every plant we recommend.",
                   "checked for Palm Beach County"):
        assert phrase in text
    for gone in ("Welcome to", "picked for South Florida", "one plant at a time"):
        assert gone not in text
    for piece in ("EcoLoco_Scanning_Plant.png", "<LetterDemo />", "<IdentifyDemo image={IMG_SCANNING} />",
                  "PHOTOS.home", "count: '179'", "count: '5,322'", "count: '30'"):
        assert piece in text


def test_identify_shows_every_photo():
    assert "<PhotoStrip" in (FRONTEND / "screens" / "IdentificationScreen.js").read_text(encoding="utf-8")



THEME = (FRONTEND / "theme.js").read_text(encoding="utf-8")


def _theme_number(group, name):
    block = THEME[THEME.index(f"export const {group} = {{"):]
    return int(re.search(rf"\b{name}:\s*(\d+)", block).group(1))


def test_type_scale_keeps_text_readable():
    assert _theme_number("TYPE", "body") >= 16
    assert _theme_number("TYPE", "link") >= 15


def test_font_sizes_come_from_the_theme():
    allowed = {"HomeDemos.js", "PercentRing.js"}
    literal = [p.name for p in FILES if p.name not in allowed and re.search(r"fontSize:\s*\d", p.read_text(encoding="utf-8"))]
    assert literal == []


def test_motion_is_short_and_respects_reduce_motion():
    motion = (FRONTEND / "motion.js").read_text(encoding="utf-8")
    assert int(re.search(r"export const DURATION = (\d+);", motion).group(1)) <= 400
    assert "isReduceMotionEnabled" in motion
    for name in ("Reveal.js", "StatusBadge.js", "PercentRing.js", "ScanningLeaf.js", "HomeDemos.js"):
        assert "useReduceMotion" in (FRONTEND / "components" / name).read_text(encoding="utf-8"), name
    assert "useReduceMotion" in (FRONTEND / "screens" / "HomeScreen.js").read_text(encoding="utf-8")
    for p in FILES:
        for ms in re.findall(r"duration:\s*(\d+)", p.read_text(encoding="utf-8")):
            assert int(ms) <= 400, (p.name, ms)


def test_invasive_results_get_their_own_haptic():
    motion = (FRONTEND / "motion.js").read_text(encoding="utf-8")
    assert "status === 'invasive'" in motion and "NotificationFeedbackType.Warning" in motion
    assert "feelResult(status)" in (FRONTEND / "components" / "StatusBadge.js").read_text(encoding="utf-8")


def test_scanning_shows_the_leaf_animation():
    assert "leaf.json" in (FRONTEND / "components" / "ScanningLeaf.js").read_text(encoding="utf-8")
    for screen in ("AuditScreen.js", "IdentificationScreen.js"):
        assert "<ScanningLeaf" in (FRONTEND / "screens" / screen).read_text(encoding="utf-8")
