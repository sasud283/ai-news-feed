"""Verify enum removal and conservative legacy story migration."""


async def test_legacy_story_is_redistributed_and_requires_review(pg):
    labels = await pg.fetchval("SELECT enum_range(NULL::story_topic)::text")
    assert "Future of Work" not in labels
    assert all(
        label in labels for label in ["Leadership", "Organisations", "People & Jobs"]
    )
    # The original seed included a job-market article under the legacy work label.
    story = "11111111-1111-4111-8111-000000000007"
    assert (
        await pg.fetchval("SELECT publication_status FROM stories WHERE id=$1", story)
        == "review"
    )
    assert (
        await pg.fetchval(
            "SELECT count(*) FROM spot_check_queue WHERE story_id=$1 AND status='pending'",
            story,
        )
        == 1
    )


async def test_preference_expansion_keeps_other_topics_and_removes_duplicates(pg):
    # pg_temp helper exists on this test connection after the migration.
    result = await pg.fetchval(
        "SELECT pg_temp.expand_work_topics($1::text[])",
        ["Ethics", "Future of Work", "Organisations"],
    )
    assert result == ["Ethics", "Leadership", "Organisations", "People & Jobs"]


async def test_all_three_new_topics_can_be_stored(pg):
    story = "11111111-1111-4111-8111-000000000001"
    for topic in ["Leadership", "Organisations", "People & Jobs"]:
        await pg.execute(
            "INSERT INTO story_topics(story_id,topic) VALUES($1,$2) ON CONFLICT DO NOTHING",
            story,
            topic,
        )
    rows = await pg.fetch("SELECT topic FROM story_topics WHERE story_id=$1", story)
    assert {"Leadership", "Organisations", "People & Jobs"} <= {
        r["topic"] for r in rows
    }
