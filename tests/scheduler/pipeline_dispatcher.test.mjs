import { test } from "node:test";
import assert from "node:assert/strict";
import { dispatchPipeline, isPipelineTime } from "../../src/scheduler/pipeline_dispatcher.mjs";

test("only the UTC trigger matching 13:05 Malta dispatches across DST", () => {
  assert.equal(isPipelineTime("2026-09-25T11:05:00Z"), true);
  assert.equal(isPipelineTime("2026-09-25T12:05:00Z"), false);
  assert.equal(isPipelineTime("2026-12-25T11:05:00Z"), false);
  assert.equal(isPipelineTime("2026-12-25T12:05:00Z"), true);
});

test("dispatch uses the existing workflow and a scoped secret", async () => {
  const calls = [];
  const fetchImpl = async (...args) => {
    calls.push(args);
    return new Response(null, { status: 204 });
  };
  assert.equal(await dispatchPipeline("2026-09-25T12:05:00Z", "secret", fetchImpl), false);
  assert.equal(await dispatchPipeline("2026-09-25T11:05:00Z", "secret", fetchImpl), true);
  assert.equal(calls.length, 1);
  assert.match(calls[0][0], /actions\/workflows\/pipeline\.yml\/dispatches$/);
  assert.equal(calls[0][1].headers.Authorization, "Bearer secret");
  assert.deepEqual(JSON.parse(calls[0][1].body), { ref: "main" });
});

test("missing credentials and dispatch failures stop the scheduled invocation", async () => {
  await assert.rejects(dispatchPipeline("2026-09-25T11:05:00Z", ""), /credential/);
  await assert.rejects(
    dispatchPipeline(
      "2026-09-25T11:05:00Z",
      "secret",
      async () => new Response(null, { status: 403 }),
    ),
    /HTTP 403/,
  );
});
