- [x] Move color from section backgrounds into tags, options, selections, and buttons
- [x] Rebrand all visible site copy and metadata to TheFullPicture.ai
- [x] Verify desktop and mobile presentation

- [x] Add digest topic preferences with Everything selected by default
- [x] Store digest filter preferences with subscriber consent
- [x] Move plan and payment choices into a checkout modal
- [x] Verify the updated subscription flow on desktop and mobile
- [x] Make filter topics solid-colored and tone/access/geography neutral outlined
- [x] Restyle TheFullPicture.ai with a thoughtful newsletter aesthetic
- [x] Verify the refreshed header, filters, cards, and mobile layout
- [x] Remove public header navigation and account controls while keeping /review directly accessible
- [x] Transform the opening, leaderboard advert, and filters into one editorial hero banner
- [x] Verify the new hero on desktop and mobile

## Current
- [x] Feed recency tabs (Latest / This week / This month / Older) on the feed itself; switching re-filters the list via the range URL param (verified below)
- [x] Add Article / Podcast / Video content types to stories and cards
- [x] Add podcast and video media displays with safe source-link fallbacks
- [x] Add a shareable Content Type filter to the filter bar
- [x] Verify all three card variants on desktop and mobile
- [x] Add "keeps the AI pipeline / site alive" copy plus coffee-price framing to newsletter CTAs


## Python backend

- [x] Phase 1: RSS ingestion and expanded source registry
- [x] Phase 2: local deduplication, GPT-4o-mini classification/summaries, review flags
- [ ] Evaluate model quality against representative editorial examples
- [x] Phase 3 implementation: persistent state, Supabase mapping, review/publishing handoff
- [x] Phase 3 live database: private connection, migrations 0000–0004, publication-policy smoke test
- [x] Phase 3 local activation: confirmed editor/admin account, OpenAI key, real batch and editorial review
- [ ] Phase 3 hosted deployment/review check

## Frontend integration

- [x] Merge Lovable through 033f618 with the six impact labels and protected publishing flow
- [x] Prevent unverified newsletter signups: checkout disabled, no subscriber inserts or confirmation claims
- [ ] Connect payment verification and newsletter delivery before opening subscriptions
- [ ] Configure hosting and scheduled ingestion

## Phase 4: site launch preparation

The existing Lovable/TanStack frontend replaces the original Jinja2 site phase.
Keep the integrated frontend and Supabase publishing workflow.

- [x] Make unconfigured newsletter signup explicitly unavailable
- [x] Remove payment and delivery claims from the directly accessible confirmation route
- [x] Remove inaccurate annual “save 2 months” claim (current prices do not support it)
- [x] Build Stripe/Supabase/Resend integration for both daily and weekly editions
- [ ] Validate Stripe payments and provider delivery in test mode before activation
- [x] Persist topic preferences with pending checkout; only worker-verified payment grants access
- [ ] Verify cancelled checkout, retries, duplicate callbacks, cancellation and email delivery
- [ ] Configure hosted frontend for the current Supabase project and check admin sign-in/RLS
- [ ] Verify desktop/mobile feed, filters, source links and protected review on the hosted site

Phase 5 remains scheduled ingestion and operational monitoring. See
[launch checklist](development/launch.md) for the remaining setup.

## Newsletter build

- [x] Private billing records, explicit complimentary access and subscriber overview
- [x] Paid-through checks, renewal reconciliation and cancellation handling
- [x] First edition due immediately for both cadences; scheduled daily/weekly editions
- [x] Resend delivery ledger, idempotent retries, unsubscribe and billing portal links
- [x] Scheduled worker definition (disabled until configured)
- [ ] Save Resend credentials and verify the temporary sending domain
- [ ] Verify real test deliveries to both complimentary readers
- [ ] Configure Stripe products, test payments, hosted scheduler and missed-run alerts

See [newsletter implementation and activation](development/newsletter.md).

## Work category expansion

- [x] Replace the active work topic with Leadership, Organisations, People & Jobs
- [x] Update model IDs, frontend filters, review validation and newsletter preferences
- [x] Verify 25 proposed feeds; activate nine and retain 16 in the action checklist
- [x] Retain and redistribute existing sources, including original audit provenance
- [x] Apply migration 0007 to the live database

See [category migration](development/work-categories.md) and
[source actions](sources/actions-required.md).

- [ ] Before live: verify the deferred regional/non-English candidates in [Sources — Actions Required](sources/actions-required.md), then implement and test English summaries.
