"""Storage handoff structures deliberately exclude transient publisher text."""

from dataclasses import fields

from src.processing.models import ProcessedStory, StorySource


def test_storage_models_exclude_source_body_fields():
    for model in (ProcessedStory, StorySource):
        names = {f.name for f in fields(model)}
        assert not names & {"raw_summary", "body", "content", "excerpt"}
    assert StorySource("Source", "https://example.com").access is None
