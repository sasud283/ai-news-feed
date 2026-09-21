import { test } from "node:test";
import assert from "node:assert/strict";
import { preventIndexing } from "../../src/lib/indexing.ts";

test("noindex covers normal, redirect and error responses without dropping headers", async () => {
  for (const status of [200, 302, 404, 500]) {
    const response = preventIndexing(
      new Response("test", {
        status,
        headers: { Location: "/auth", "Content-Type": "text/plain" },
      }),
    );
    assert.equal(response.status, status);
    assert.equal(response.headers.get("X-Robots-Tag"), "noindex, nofollow, noarchive");
    assert.equal(response.headers.get("Location"), "/auth");
    assert.equal(await response.text(), "test");
  }
});
