"""Storage history holds only deduplication metadata."""

from dataclasses import FrozenInstanceError

import pytest

from src.storage.models import ProcessingHistory


def test_history_is_immutable():
    history = ProcessingHistory(frozenset({"https://example.test/story"}), ())
    with pytest.raises(FrozenInstanceError):
        history.seen_urls = frozenset()
