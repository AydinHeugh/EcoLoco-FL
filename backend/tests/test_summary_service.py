from services.summary_service import summarize


def observed(name, **extra):
    return {"scientific_name": name, "needs_confirmation": False, **extra}


def test_summary_deduplicates_species_and_synonyms():
    summary = summarize([observed("Zamia integrifolia"), observed("Zamia floridana"),
                         observed("Schinus terebinthifolius")])
    assert summary["counts"] == {"native": 1, "non_native": 0, "invasive": 1, "unknown": 0}
    assert summary["plant_count"] == 3 and summary["known"] == 2
    assert summary["percent_native"] == 50
    assert summary["percent_native_with_plan"] == 50


def test_projection_uses_only_explicit_taxa():
    plants = [observed("Schinus terebinthifolius"), observed("Zamia integrifolia")]
    summary = summarize(plants, additions=["Muhlenbergia capillaris"])
    assert summary["percent_native"] == 50
    assert summary["percent_native_with_plan"] == 66.7
    assert summary["counts_with_plan"]["invasive"] == 1
    changed = summarize(plants, additions=["Muhlenbergia capillaris"], removals=["Schinus terebinthifolius"])
    assert changed["percent_native_with_plan"] == 100


def test_unconfirmed_and_unknown_stay_out_of_denominator():
    summary = summarize([observed("Zamia integrifolia", needs_confirmation=True),
                         observed("Plantus imaginarius"), observed("Hamelia patens")])
    assert summary["known"] == 0
    assert summary["percent_native"] is None
    assert summary["percent_native_with_plan"] is None
    assert summary["counts"]["unknown"] == 3
    assert len(summary["unresolved"]) == 3


def test_labels_cannot_forge_status():
    summary = summarize([observed("Schinus terebinthifolius", invasive_status="native", status_verified=True)])
    assert summary["counts"]["invasive"] == 1
    assert summary["percent_native"] == 0
