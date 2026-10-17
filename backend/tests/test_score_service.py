from services.score_service import calculate_biodiversity_score


def _plant(name, status):
    return {"name": name, "status": status, "wildlife_support": "low"}


def test_breakdown_has_four_groups_and_only_invasives_hurt():
    result = calculate_biodiversity_score([
        _plant("Coontie", "native"),
        _plant("Ixora", "non-native"),
        _plant("Cardboard cycad", "non-native"),
        _plant("Brazilian pepper", "invasive"),
        _plant("Tree tumbo", "unknown"),
    ])
    assert result["breakdown"] == {
        "native": ["Coontie"],
        "non_native": ["Ixora", "Cardboard cycad"],
        "invasive": ["Brazilian pepper"],
        "unknown": ["Tree tumbo"],
    }
