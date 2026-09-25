# Daily and weekly newsletters

Both cadences are launch requirements. Stripe is the billing authority, Supabase
stores private subscriber state, and Resend delivers the editions. No additional
model call is made for a digest: it uses already reviewed, published summaries.

## Access and delivery

- Checkout creates only a pending record. Redirects never prove payment.
- The worker recovers completed checkout sessions directly from Stripe, including
  missed callbacks. Signed Stripe webhooks are recorded idempotently as hints;
  they do not grant access or dispatch the worker themselves.
- Each pass refreshes all non-unsubscribed paying readers; before a paid send it
  checks Stripe again. Entitlement comes from a settled, positive-value invoice
  and its non-prorated subscription period, not the next unpaid invoice. Refunded
  or disputed charges do not grant access. Trials and out-of-band payments do not
  grant access. Test/live Stripe mode must match the worker configuration.
- Cancelling at period end preserves access until that paid period ends. An
  immediate cancellation stops delivery. Failed renewals do not extend access.
- Complimentary readers have a separate access kind and a recorded owner reason.
  No browser request can create complimentary or paid entitlement.
- New readers are due immediately, for either cadence, including weekends. They
  receive an initial edition even if no matching stories are currently available.
  Thereafter daily editions run every day at 07:00 Europe/Malta; Friday includes
  the weekly round-up. Weekly editions run Friday at 07:00 Europe/Malta. DST is
  handled by the timezone database. Up to 30 matching stories are included.
- Each email has an unsubscribe link and RFC 8058 one-click unsubscribe headers.
  Unsubscribing stops email immediately; the page separately links to Stripe's
  billing portal to cancel charges. This separation is stated explicitly.
- Bodies are HTML-escaped, only published stories are included, and topic choices
  apply. Newsletter records and saved delivery payloads are private.

## Reliability and limits

A database advisory lock prevents concurrent workers. Delivery payloads and
idempotency keys are persisted before sending; retries reuse the same payload/key.
Resend retains keys for 24 hours, so ambiguous attempts stop after 23 hours for
manual reconciliation rather than risk duplicate mail. Check the Resend dashboard
and local delivery record before changing an ambiguous delivery's state.

Provider acceptance is recorded separately from delivered status. Subsequent
passes check Resend delivery status; bounces/complaints suppress future sends.
Failures and first editions outstanding after 22 hours fail the worker and log
safe identifiers. Logs never include emails, tokens or provider response bodies.

The included GitHub Actions workflow is disabled unless the repository variable
`NEWSLETTER_ENABLED=true`. It requests one run per day at 07:07 Europe/Malta.
Each run reads the current subscriber and entitlement records before sending;
there is no midnight snapshot. The workflow is restricted to complimentary test
readers. GitHub schedules
can be delayed or dropped. It is useful for initial testing, **not a hard 24-hour
SLA**. Before paid launch, configure a reliable hosted scheduler plus an external
missed-run alert, enable failure notifications, and test recovery. Inbox placement
cannot be guaranteed by an API acceptance response. Keep checkout disabled until
this activation work is complete. Paid signup also needs a prompt first-send
trigger so a reader joining just after 07:07 does not wait more than 24 hours.

The worker is designed for the initial small subscriber base. It polls Stripe and
Resend conservatively; measure duration before growing beyond the 12-minute job
budget. Resend free-tier daily and monthly limits apply. Increase the sending plan
before volume exceeds them. Do not change Stripe prices or enable portal plan
switching without updating/testing the product mapping; the initial integration
uses four fixed recurring prices, no trials/coupons/prorations.

## Local activation

Migration `0006_newsletter.sql` adds the private tables and revokes the legacy
anonymous `digest_subscribers` insert permission. The latter table is not a paid
subscriber authority. The migration journal must be updated when applied.

Migration 0006 and the two owner-authorised complimentary subscriptions were applied
to the live Supabase project on 2026-09-21. Both received first editions on
2026-09-24. Public checkout remains disabled pending Stripe setup and validation.
The site uses a Cloudflare Hyperdrive binding for its Supabase connection.

Read-only administrator overview: `/subscribers`, also linked from `/review`.
It distinguishes complimentary readers, paid-through dates, last verification and
provider delivery status. Browser refresh does not itself reconcile Stripe.

Configure the variables in `.env.example` privately in `.env.local` and on the host:

- `NEWSLETTER_FROM`: `TheFullPicture.ai <newsletter@thefullpicture-ai.xyz>`.
  Verify this domain in Resend first.
- `NEWSLETTER_REPLY_TO`: `thefullpictureai@gmail.com`.
- `RESEND_API_KEY`: needs email send and email-status retrieval permissions.
- `NEWSLETTER_SITE_URL`: the hosted website origin, for working management links.
- `NEWSLETTER_LINK_SECRET`: a long random secret, identical on website and worker.
  Rotating it invalidates old management links.
- `NEWSLETTER_POSTAL_ADDRESS`: final public footer address. Private complimentary
  tests may omit it only with `NEWSLETTER_TEST_ONLY=true`; public sending cannot.
- Stripe secret, webhook signing secret, and four price IDs: weekly €3/month or
  €35/year; daily €5/month or €55/year. Validate the amounts in Stripe before launch.
- Configure Stripe's billing portal for payment method updates and cancellation
  at period end. Register `/api/newsletter/stripe-webhook` for checkout, invoice
  and subscription events. Use Stripe test mode first and a separate test database.

The owner-authorised test readers are registered separately in the live database:
Sarah's Gmail receives daily editions; TheFullPictureAI's Gmail receives weekly.
Provisioning is idempotent and does not silently undo an unsubscribe:

```sh
python -m src.newsletter.provision --email ADDRESS --cadence daily --reason 'Owner-authorised testing'
```

The Python worker expects variables in its process environment; it does not load
`.env.local` automatically. With private variables loaded, run:

```sh
python -m src.newsletter.worker
```

`NEWSLETTER_SEND_ENABLED=true` permits a worker run. Start with
`NEWSLETTER_TEST_ONLY=true`, which only sends to explicit complimentary readers.
Keep `NEWSLETTER_CHECKOUT_ENABLED=false` until live activation passes.

## Validation

```sh
python -m pytest
node --test tests/newsletter/security.test.mjs
ruff check src/newsletter tests/newsletter tests/storage/test_newsletter.py
black --check src/newsletter tests/newsletter tests/storage/test_newsletter.py
npm run build
```

Before opening payments, test in Stripe test mode: both cadences, all four prices,
successful initial payment, failed renewal, successful retry, period-end and
immediate cancellation, duplicate/out-of-order callbacks and missed callbacks.
Verify actual Resend delivery to both test readers, unsubscribe behaviour, and
scheduler failure alerts. Automated mocks are not a substitute for this live setup.
