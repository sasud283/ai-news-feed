"""Newsletter logs exclude subscriber addresses and private credentials."""

import json
import logging

from src.newsletter.logging import NewsletterFormatter


def test_formatter_only_includes_safe_identifiers():
    record = logging.LogRecord(
        "newsletter", logging.ERROR, "", 0, "newsletter_failed", (), None
    )
    record.member_id = "member-1"
    record.email = "private@example.com"
    record.token = "secret"
    result = json.loads(NewsletterFormatter().format(record))
    assert result["member_id"] == "member-1"
    assert "private@example.com" not in str(result)
    assert "secret" not in str(result)
