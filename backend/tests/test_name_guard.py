import pytest

from services.name_guard import mentions_new_names


@pytest.mark.parametrize("text, allowed", [
    ("Our campus could host the Northern mockingbird.", "birds visit our campus"),
    ("Saw palmetto would help too.", "coontie and firebush"),
    ("Bees love it.", "butterflies love it"),
    ("A live oak would shade the yard.", "Coontie helps atala butterflies."),
    ("Monarch butterflies would visit.", "atala butterflies"),
])
def test_new_names_are_caught(text, allowed):
    assert mentions_new_names(text, allowed) is True


@pytest.mark.parametrize("text, allowed", [
    ("We want more birds and butterflies.", "Birds and butterflies feed here."),
    ("We have been busy this year.", ""),
    ("Bees love it.", "bees visit its flowers"),
    ("Coontie helps the atala butterfly.", "Coontie: caterpillars of the atala butterfly eat its leaves."),
    ("We checked 4 plants and 50% are native.", "Of the plants we checked, 50% are native."),
])
def test_known_or_harmless_text_passes(text, allowed):
    assert mentions_new_names(text, allowed) is False
