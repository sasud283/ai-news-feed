import postgres from "postgres";
import { z } from "zod";
import { verifyMember, verifyStripe } from "./security.server";

const topics = z.enum([
  "Models & Research",
  "Business & Funding",
  "Policy & Regulation",
  "National Initiatives",
  "Ethics",
  "Leadership",
  "Organisations",
  "People & Jobs",
  "Future of Daily Life",
  "AI Equity & Representation",
  "Tools & Products",
]);
const inputSchema = z.object({
  email: z
    .string()
    .trim()
    .email()
    .max(254)
    .transform((v) => v.toLowerCase()),
  cadence: z.enum(["daily", "weekly"]),
  plan: z.enum(["monthly", "yearly"]),
  topics: z.array(topics).max(11),
  consent: z.literal(true),
});
function createDatabase() {
  const url = process.env["DATABASE_URL"];
  if (!url) throw new Error("Database not configured");
  return postgres(url, {
    max: 1,
    prepare: false,
    connect_timeout: 10,
    idle_timeout: 20,
  });
}
function config(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error("Newsletter configuration incomplete");
  return value;
}
function enabled() {
  return (
    process.env["NEWSLETTER_CHECKOUT_ENABLED"] === "true" &&
    [
      "STRIPE_SECRET_KEY",
      "STRIPE_WEBHOOK_SECRET",
      "DATABASE_URL",
      "RESEND_API_KEY",
      "NEWSLETTER_SITE_URL",
      "NEWSLETTER_FROM",
      "NEWSLETTER_LINK_SECRET",
      "NEWSLETTER_POSTAL_ADDRESS",
      "STRIPE_PRICE_DAILY_MONTHLY",
      "STRIPE_PRICE_DAILY_YEARLY",
      "STRIPE_PRICE_WEEKLY_MONTHLY",
      "STRIPE_PRICE_WEEKLY_YEARLY",
    ].every((key) => Boolean(process.env[key]))
  );
}
async function stripe(path: string, data: URLSearchParams, idempotency?: string) {
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config("STRIPE_SECRET_KEY")}`,
      "Stripe-Version": "2024-06-20",
      "Content-Type": "application/x-www-form-urlencoded",
      ...(idempotency ? { "Idempotency-Key": idempotency } : {}),
    },
    body: data,
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error("Billing provider unavailable");
  return response.json();
}
function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
function page(message: string, content = "") {
  return new Response(
    `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Newsletter — TheFullPicture.ai</title><body><main><h1>${message}</h1>${content}<p><a href="/">Back to the feed</a></p></main></body></html>`,
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
        "Content-Security-Policy": "default-src 'none'; form-action 'self'; frame-ancestors 'none'",
      },
    },
  );
}

/** Handle checkout, signed webhook hints and signed subscriber management. */
export async function newsletterRequest(request: Request, action: string): Promise<Response> {
  let connection: ReturnType<typeof postgres> | undefined;
  const db = () => (connection ??= createDatabase());
  try {
    const url = new URL(request.url);
    if (action === "availability" && request.method === "GET") return json({ enabled: enabled() });
    if (action === "stripe-webhook" && request.method === "POST") {
      const raw = await request.text();
      if (
        raw.length > 1_000_000 ||
        !verifyStripe(
          raw,
          request.headers.get("stripe-signature") ?? "",
          config("STRIPE_WEBHOOK_SECRET"),
        )
      )
        return json({ error: "Invalid signature" }, 400);
      const event = z.object({ id: z.string().startsWith("evt_") }).parse(JSON.parse(raw));
      // The worker always retrieves authoritative Stripe state. Out-of-order or
      // forged object fields cannot grant access; duplicate hints are harmless.
      await db()`INSERT INTO newsletter_events(event_id) VALUES(${event.id}) ON CONFLICT DO NOTHING`;
      return json({ received: true });
    }
    if (action === "checkout" && request.method === "POST") {
      if (!enabled()) return json({ error: "Subscriptions are not open yet." }, 503);
      const site = new URL(config("NEWSLETTER_SITE_URL"));
      if (request.headers.get("origin") !== site.origin)
        return json({ error: "Invalid origin" }, 403);
      const raw = await request.text();
      if (raw.length > 4096) return json({ error: "Request too large" }, 413);
      const input = inputSchema.parse(JSON.parse(raw));
      const sql = db();
      const row = await sql.begin(async (tx) => {
        // Serialise by email, limiting accidental duplicates and abuse. Reuse
        // the same pending checkout instead of creating a second subscription.
        await tx`SELECT pg_advisory_xact_lock(hashtextextended(${input.email},746320915))`;
        const active = await tx`SELECT id FROM newsletter_members WHERE lower(email)=${input.email}
          AND access_kind='paid' AND (status IN ('active','past_due','trialing','unpaid','paused')) LIMIT 1`;
        if (active.length) return null;
        const pending = await tx`SELECT * FROM newsletter_checkouts WHERE email=${input.email}
          AND created_at > now()-interval '24 hours' ORDER BY created_at DESC LIMIT 1`;
        if (pending.length) {
          const prior = pending[0]!;
          if (
            prior["completed"] ||
            prior["cadence"] !== input.cadence ||
            prior["plan"] !== input.plan ||
            JSON.stringify(prior["topics"]) !== JSON.stringify(input.topics)
          )
            return null;
          return prior;
        }
        const recent =
          await tx`SELECT count(*)::int AS count FROM newsletter_checkouts WHERE created_at > now()-interval '1 hour'`;
        if (recent[0]!["count"] >= 100) return null;
        const inserted = await tx`INSERT INTO newsletter_checkouts(email,cadence,plan,topics)
          VALUES(${input.email},${input.cadence},${input.plan},${input.topics}) RETURNING *`;
        return inserted[0]!;
      });
      if (!row)
        return json(
          {
            error:
              "A subscription or recent checkout may already exist. Use the management link in your newsletter, or try again later.",
          },
          409,
        );
      const price = config(
        `STRIPE_PRICE_${input.cadence.toUpperCase()}_${input.plan.toUpperCase()}`,
      );
      const session = await stripe(
        "checkout/sessions",
        new URLSearchParams({
          mode: "subscription",
          customer_email: input.email,
          "line_items[0][price]": price,
          "line_items[0][quantity]": "1",
          "payment_method_types[0]": "card",
          client_reference_id: row["id"],
          "subscription_data[metadata][newsletter_checkout]": row["id"],
          success_url: `${site.origin}/subscribe/confirmed`,
          cancel_url: `${site.origin}/subscribe`,
        }),
        `newsletter-checkout/${row["id"]}`,
      );
      await sql`UPDATE newsletter_checkouts SET stripe_session_id=${session.id} WHERE id=${row["id"]}`;
      return json({ url: session.url });
    }
    if (["manage", "unsubscribe", "portal"].includes(action)) {
      const id = z.string().uuid().parse(url.searchParams.get("id"));
      const token = url.searchParams.get("token") ?? "";
      if (!verifyMember(id, token, config("NEWSLETTER_LINK_SECRET")))
        return json({ error: "Invalid subscriber link" }, 403);
      const rows = await db()`SELECT * FROM newsletter_members WHERE id=${id}`;
      const member = rows[0];
      if (!member) return json({ error: "Subscriber not found" }, 404);
      const query = new URLSearchParams({ id, token }).toString();
      if (request.method === "GET") {
        return page(
          "Manage your newsletter",
          `<p>Unsubscribing stops emails immediately. For a paid subscription, use Manage billing to cancel future charges.</p><form method="post" action="/api/newsletter/unsubscribe?${query}"><button>Stop newsletter emails</button></form>${member["stripe_customer_id"] ? `<form method="post" action="/api/newsletter/portal?${query}"><button>Manage billing / cancel subscription</button></form>` : "<p>This is a complimentary subscription; there are no charges.</p>"}`,
        );
      }
      if (request.method === "POST" && action === "unsubscribe") {
        await db()`UPDATE newsletter_members SET unsubscribed=true WHERE id=${id}`;
        return page(
          "Newsletter emails stopped",
          member["stripe_customer_id"]
            ? `<p>To cancel future charges too:</p><form method="post" action="/api/newsletter/portal?${query}"><button>Manage billing / cancel subscription</button></form>`
            : "",
        );
      }
      if (request.method === "POST" && action === "portal" && member["stripe_customer_id"]) {
        const session = await stripe(
          "billing_portal/sessions",
          new URLSearchParams({
            customer: member["stripe_customer_id"],
            return_url: config("NEWSLETTER_SITE_URL"),
          }),
        );
        return new Response(null, {
          status: 303,
          headers: { Location: session.url, "Cache-Control": "no-store" },
        });
      }
    }
    return json({ error: "Not found" }, 404);
  } catch (error) {
    // Never expose database DSNs, provider responses, email addresses or tokens.
    if (error instanceof z.ZodError || error instanceof SyntaxError)
      return json({ error: "Invalid request" }, 400);
    console.error(
      JSON.stringify({
        event: "newsletter_api_failed",
        action,
        error_type: error instanceof Error ? error.name : "unknown",
      }),
    );
    return json({ error: "Newsletter service is temporarily unavailable." }, 503);
  } finally {
    await connection?.end({ timeout: 5 });
  }
}

/** Read subscription status after the caller has verified administrator access. */
export async function readMembers() {
  const sql = createDatabase();
  try {
    const rows = await sql`SELECT m.id,m.email,m.cadence,m.access_kind,m.status,m.unsubscribed,
      m.paid_until,m.verified_at,m.first_sent_at,m.next_send_at,
      (SELECT delivery_status FROM newsletter_deliveries WHERE member_id=m.id ORDER BY due_at DESC LIMIT 1) AS delivery_status
    FROM newsletter_members m ORDER BY created_at DESC`;
    return rows.map((row) => ({
      id: String(row["id"]),
      email: String(row["email"]),
      cadence: String(row["cadence"]),
      accessKind: String(row["access_kind"]),
      status: String(row["status"]),
      unsubscribed: Boolean(row["unsubscribed"]),
      paidUntil: row["paid_until"] ? new Date(row["paid_until"]).toISOString() : null,
      verifiedAt: row["verified_at"] ? new Date(row["verified_at"]).toISOString() : null,
      nextSendAt: new Date(row["next_send_at"]).toISOString(),
      deliveryStatus: row["delivery_status"] ? String(row["delivery_status"]) : "Not sent",
    }));
  } finally {
    await sql.end({ timeout: 5 });
  }
}
