"""Reusable HTML and plain-text layouts for newsletter editions."""

from __future__ import annotations

import html
from collections.abc import Mapping, Sequence
from datetime import datetime
from urllib.parse import urlsplit
from zoneinfo import ZoneInfo

_MALTA = ZoneInfo("Europe/Malta")


def _date(value: datetime | None) -> str:
    if value is None:
        return "Date not supplied"
    local = value.astimezone(_MALTA)
    return f"{local.day} {local.strftime('%B %Y')}"


def render_digest(
    stories: Sequence[Mapping[str, object]],
    *,
    cadence: str,
    issued_at: datetime,
    first_edition: bool,
    site_url: str,
    manage_url: str,
    postal_address: str,
) -> tuple[str, str, str]:
    """Build consistent HTML and text editions from published story metadata.

    Args:
        stories: Published stories with a headline, summary, date, source, and URL.
        cadence: Daily or weekly edition.
        issued_at: Time the edition is composed.
        first_edition: Whether this is the reader's welcome edition.
        site_url: Public site origin for fallback story links.
        manage_url: Signed subscriber management URL.
        postal_address: Public footer address or private-test disclosure.

    Returns:
        Subject, HTML body, and plain-text body.
    """
    if cadence not in {"daily", "weekly"}:
        raise ValueError("Unknown newsletter cadence")
    edition = "Daily AI briefing" if cadence == "daily" else "Weekly AI digest"
    title = f"TheFullPicture.ai — {edition}"
    issue_date = _date(issued_at)
    subject = f"{title} — {issue_date}"
    opening = (
        "Welcome to TheFullPicture.ai. Here is your first edition."
        if first_edition
        else "Reviewed AI stories, with the original sources linked below."
    )
    parts = [
        '<!doctype html><html lang="en"><head><meta charset="utf-8">',
        '<meta name="viewport" content="width=device-width,initial-scale=1"></head>',
        '<body style="margin:0;padding:0;background:#f5f3ef;color:#1f2937;">',
        '<div style="display:none;max-height:0;overflow:hidden;opacity:0;">',
        "Reviewed AI stories with publication dates and original sources.</div>",
        (
            '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
            'style="background:#f5f3ef;"><tr><td align="center" style="padding:24px 12px;">'
        ),
        (
            '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
            'style="max-width:620px;background:#ffffff;border:1px solid #e5e1d9;">'
        ),
        '<tr><td style="padding:28px 28px 12px;font-family:Arial,sans-serif;">',
        (
            '<p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:2px;'
            'text-transform:uppercase;color:#5b496b;">Independent AI news</p>'
        ),
        f'<h1 style="margin:0;font-size:29px;line-height:1.2;">{html.escape(title)}</h1>',
        f'<p style="margin:10px 0 0;color:#6b7280;font-size:14px;">{html.escape(issue_date)}</p>',
        f'<p style="margin:20px 0 0;font-size:15px;line-height:1.6;">{html.escape(opening)}</p>',
        "</td></tr>",
    ]
    plain = [title, issue_date, "", opening]
    if not stories:
        message = "No new reviewed stories match your topics in this edition."
        parts.append(
            '<tr><td style="padding:14px 28px 28px;font-family:Arial,sans-serif;'
            f'font-size:15px;line-height:1.6;">{html.escape(message)}</td></tr>'
        )
        plain.extend(["", message])
    for story in stories:
        headline = str(story["headline"])
        summary = str(story["ai_generated_summary"])
        source = str(story.get("source_name") or "Original source")
        content_type = str(story.get("content_type") or "Article")
        published_at = story.get("published_at")
        published = _date(published_at if isinstance(published_at, datetime) else None)
        url = str(story.get("url") or site_url)
        parsed = urlsplit(url)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            url = site_url
        meta = f"Source: {source} · Type: {content_type} · Published: {published}"
        parts.extend(
            [
                (
                    '<tr><td style="padding:20px 28px 22px;border-top:1px solid #e5e1d9;'
                    'font-family:Arial,sans-serif;">'
                ),
                f'<p style="margin:0 0 10px;color:#6b7280;font-size:12px;">{html.escape(meta)}</p>',
                f'<h2 style="margin:0 0 10px;font-size:20px;line-height:1.3;">{html.escape(headline)}</h2>',
                f'<p style="margin:0 0 13px;font-size:15px;line-height:1.6;">{html.escape(summary)}</p>',
                (
                    f'<a href="{html.escape(url, quote=True)}" style="color:#5b496b;'
                    'font-size:14px;font-weight:700;">Open original source</a>'
                ),
                "</td></tr>",
            ]
        )
        plain.extend(["", meta, headline, summary, url])
    parts.extend(
        [
            (
                '<tr><td style="padding:22px 28px;background:#f5f3ef;'
                'font-family:Arial,sans-serif;font-size:12px;line-height:1.6;color:#596170;">'
            ),
            (
                f'<a href="{html.escape(manage_url, quote=True)}" style="color:#5b496b;">'
                "Manage subscription or unsubscribe</a><br>"
            ),
            f"{html.escape(postal_address)}",
            "</td></tr></table></td></tr></table></body></html>",
        ]
    )
    plain.extend(
        ["", f"Manage subscription or unsubscribe: {manage_url}", postal_address]
    )
    return subject, "".join(parts), "\n".join(plain)
