"""Create explicitly authorised complimentary subscribers without billing."""

import argparse
import asyncio
import os

import asyncpg

from src.newsletter.logging import logger


async def provision(email: str, cadence: str, reason: str) -> None:
    """Create one complimentary subscription without changing existing access.

    Args:
        email: Address explicitly authorised by the owner.
        cadence: Daily or weekly delivery.
        reason: Auditable reason for complimentary access.

    Raises:
        ValueError: Subscriber details are incomplete or malformed.
    """
    email = email.strip().lower()
    if (
        "@" not in email
        or len(email) > 254
        or cadence not in ("daily", "weekly")
        or not reason.strip()
    ):
        raise ValueError("Valid email, cadence and reason are required")
    db = await asyncpg.connect(
        os.environ["DATABASE_URL"], statement_cache_size=0, timeout=20
    )
    try:
        await db.execute(
            """INSERT INTO newsletter_members(email,cadence,access_kind,comp_reason,status)
            VALUES($1,$2,'complimentary',$3,'active')
            ON CONFLICT(lower(email),cadence) WHERE access_kind='complimentary' DO NOTHING""",
            email,
            cadence,
            reason,
        )
        logger.info("newsletter_comp_provisioned")
    finally:
        await db.close()


def main() -> None:
    """Provision an owner-authorised test reader using private database credentials."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--email", required=True)
    parser.add_argument("--cadence", choices=["daily", "weekly"], required=True)
    parser.add_argument("--reason", required=True)
    args = parser.parse_args()
    try:
        asyncio.run(provision(args.email, args.cadence, args.reason))
    except (ValueError, KeyError, OSError, asyncpg.PostgresError) as exc:
        logger.error("newsletter_comp_failed", extra={"error_type": type(exc).__name__})
        raise SystemExit(1) from None


if __name__ == "__main__":
    main()
