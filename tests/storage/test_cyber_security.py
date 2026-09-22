"""The Cyber Security category is accepted by persistent storage."""


async def test_cyber_security_topic_can_be_stored(pg):
    story = "11111111-1111-4111-8111-000000000001"
    await pg.execute(
        "INSERT INTO story_topics(story_id,topic) VALUES($1,$2)",
        story,
        "Cyber Security",
    )
    assert await pg.fetchval(
        "SELECT topic FROM story_topics WHERE story_id=$1 AND topic=$2",
        story,
        "Cyber Security",
    ) == "Cyber Security"
