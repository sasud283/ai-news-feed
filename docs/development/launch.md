# Site launch checklist

## Newsletter

Paid signup is intentionally unavailable until payment verification and delivery
are implemented. The form stays unavailable until the server checkout gate is enabled. Pending checkout records never grant access.
The legacy `/subscribe/confirmed` URL does not trust query parameters as proof of payment.
Setting checkout URLs alone must not reopen subscriptions.

Before opening subscriptions:

1. Stripe/Supabase/Resend is selected. Complete the activation checks in [newsletter.md](newsletter.md).
2. Configure the four weekly/daily and monthly/yearly products at the displayed prices.
3. Implement server-verified payment events, idempotent activation, and cancellation.
4. Store consent and topic preferences with a pending checkout, not an active subscription.
5. Connect delivery and unsubscribe handling; verify delivery before promising a send time.
6. Test failed/abandoned payments, duplicate events, retries and successful activation.

## Hosting

Configure the hosting environment for Supabase project `heafyqorilcomdmfmqll`.
The ignored local environment file does not configure hosting. The tracked `.env`
contains legacy public project settings; override them on the host. Never expose
DATABASE_URL, OPENAI_API_KEY, or billing secrets as VITE variables.

Check the published feed anonymously and admin review after deployment. Verify that
private review stories and their sources remain inaccessible to anonymous users.
Keep the existing frontend rather than adding a separate static site generator.

## Operations (Phase 5)

Configure a scheduled ingestion worker with private database/OpenAI credentials,
a conservative per-run story cap, no overlapping workers, and failure reporting.
Preserve human publication review. Test a manual hosted run before enabling its schedule.
