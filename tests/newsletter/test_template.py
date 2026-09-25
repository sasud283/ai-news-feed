"""Verify edition dates, attribution, and safe reusable email rendering."""

from datetime import UTC, datetime

from src.newsletter.template import render_digest


def test_story_date_and_source_appear_in_both_email_formats():
    subject, html_body, text_body = render_digest(
        [
            {
                "headline": "AI changes work",
                "ai_generated_summary": "A new workforce report.",
                "published_at": datetime(2026, 9, 24, 12, tzinfo=UTC),
                "source_name": "HR Dive",
                "content_type": "Article",
                "url": "https://example.com/story",
            }
        ],
        cadence="daily",
        issued_at=datetime(2026, 9, 24, 18, tzinfo=UTC),
        first_edition=True,
        site_url="https://thefullpicture-ai.xyz",
        manage_url="https://thefullpicture-ai.xyz/manage?token=test",
        postal_address="Private test edition",
    )
    assert subject == "TheFullPicture.ai — Daily AI briefing — 24 September 2026"
    assert "TheFullPicture.ai — Daily AI briefing" in html_body
    assert "Source: HR Dive · Type: Article · Published: 24 September 2026" in html_body
    assert "Source: HR Dive · Type: Article · Published: 24 September 2026" in text_body
    assert "https://example.com/story" in text_body
    assert "Welcome to TheFullPicture.ai" in text_body


def test_template_escapes_publisher_text_and_handles_missing_dates():
    subject, html_body, text_body = render_digest(
        [
            {
                "headline": "<script>bad</script>",
                "ai_generated_summary": "A & B",
                "published_at": None,
                "source_name": "Publisher <One>",
                "content_type": "Podcast",
                "url": "javascript:bad",
            }
        ],
        cadence="weekly",
        issued_at=datetime(2026, 9, 25, 6, tzinfo=UTC),
        first_edition=False,
        site_url="https://thefullpicture-ai.xyz",
        manage_url="https://thefullpicture-ai.xyz/manage?token=test",
        postal_address="Private test edition",
    )
    assert subject.startswith("TheFullPicture.ai — Weekly AI digest")
    assert "<script>" not in html_body
    assert (
        "Source: Publisher &lt;One&gt; · Type: Podcast · Published: Date not supplied"
        in html_body
    )
    assert "A &amp; B" in html_body
    assert "javascript:bad" not in html_body
    assert "https://thefullpicture-ai.xyz" in text_body
