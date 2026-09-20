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
- [ ] Phase 3 activation: confirmed editor/admin account, OpenAI key, real batch, hosted deployment/review check

## Frontend integration

- [x] Merge Lovable through 033f618 with the six impact labels and protected publishing flow
- [ ] Prevent newsletter confirmation without verified payment before deployment
- [ ] Configure hosting and scheduled ingestion
