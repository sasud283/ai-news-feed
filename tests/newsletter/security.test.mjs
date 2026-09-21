import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { verifyStripe, verifyMember } from "../../src/lib/newsletter/security.server.ts";

test("signed webhook rejects tampering, missing signatures and replay", () => {
  const body = '{"id":"evt_1"}';
  const timestamp = 1800000000;
  const digest = createHmac("sha256", "secret").update(`${timestamp}.${body}`).digest("hex");
  const signature = `t=${timestamp},v1=${digest}`;
  assert.equal(verifyStripe(body, signature, "secret", timestamp * 1000), true);
  assert.equal(verifyStripe(body + " ", signature, "secret", timestamp * 1000), false);
  assert.equal(verifyStripe(body, signature, "secret", (timestamp + 301) * 1000), false);
  assert.equal(verifyStripe(body, "", "secret", timestamp * 1000), false);
});
test("subscriber token cannot manage another subscriber", () => {
  const token = createHmac("sha256", "secret").update("newsletter:one").digest("hex");
  assert.equal(verifyMember("one", token, "secret"), true);
  assert.equal(verifyMember("two", token, "secret"), false);
  assert.equal(verifyMember("one", "malformed", "secret"), false);
});
