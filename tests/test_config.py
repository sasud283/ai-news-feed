"""The work split remains an ordered, complete editorial taxonomy."""

from src.config import CATEGORIES, CATEGORY_DESCRIPTIONS


def test_work_categories_are_ordered_and_defined():
    assert CATEGORIES[5:8] == ("Leadership", "Organisations", "People & Jobs")
    assert "Future of Work" not in CATEGORIES
    assert len(CATEGORIES) == len(set(CATEGORIES)) == 11
    assert set(CATEGORY_DESCRIPTIONS) == set(CATEGORIES[5:8])
