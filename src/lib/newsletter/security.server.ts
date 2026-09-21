import { createHmac, timingSafeEqual } from "node:crypto";

/** Compare signatures without leaking matching prefixes. */
export function equalHex(left: string, right: string): boolean {
  if (!/^[a-f0-9]{64}$/.test(left) || !/^[a-f0-9]{64}$/.test(right)) return false;
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

/** Verify the untouched Stripe body, allowing five minutes of clock skew. */
export function verifyStripe(
  body: string,
  header: string,
  secret: string,
  now = Date.now(),
): boolean {
  const parts = header.split(",").map((part) => part.split("="));
  const timestamp = parts.find(([key]) => key === "t")?.[1];
  if (!timestamp || !/^\d+$/.test(timestamp) || Math.abs(now / 1000 - Number(timestamp)) > 300)
    return false;
  const digest = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  return parts.some(([key, value]) => key === "v1" && equalHex(value ?? "", digest));
}

/** Authorise only subscriber management for a random member ID. */
export function verifyMember(id: string, token: string, secret: string): boolean {
  const expected = createHmac("sha256", secret).update(`newsletter:${id}`).digest("hex");
  return equalHex(token, expected);
}
