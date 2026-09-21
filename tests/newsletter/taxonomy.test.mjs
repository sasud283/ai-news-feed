import { test } from "node:test";
import assert from "node:assert/strict";
import { TOPICS, normalizeTopics } from "../../src/lib/taxonomy.ts";

test("old saved views retain the scope of work coverage", () => {
  assert.deepEqual(normalizeTopics(["Ethics", "Future of Work", "Organisations", "invalid"]), [
    "Ethics",
    "Leadership",
    "Organisations",
    "People & Jobs",
  ]);
  assert.equal(TOPICS.includes("Future of Work"), false);
});
