# Spot-check review page — make it viewable (design only)

## What's actually going on

The page was built. It lives at `/review` and shows the flagged-story queue with approve and correct-and-approve actions. Two things hide it today:

- It sits behind sign-in, and no account exists yet on this site (zero users), so visiting `/review` always bounces to the sign-in screen.
- There are no links to it anywhere, by design.

The queue itself has 3 pending items waiting in the database.

## What I'll do

Per your answer, keep this design-only for now — no accounts, no passwords, no real gate.

1. Move the review page out from behind sign-in so `/review` opens directly.
2. It keeps working against the real queue: you see the 3 pending flagged stories with the proposed summary and tags, and can approve or edit-then-approve.
3. Add a small "Preview mode — not protected yet" note at the top of the page so it's obvious this is temporary.
4. Keep it unlinked and hidden from search engines; you reach it only by typing `/review`.

## Later, when you want it locked down

Adding real protection is a small change at that point: either a shared editor passcode, or a proper admin account. Nothing in the page needs rebuilding.

## Technical notes

- Move `src/routes/_authenticated/review.tsx` to `src/routes/review.tsx`; drop the `useAuth`/`isAdmin` gate inside the component.
- The queue's row-level rules currently allow admin-only access, so in preview mode reads and writes go through a server function (`src/lib/review.functions.ts`) using the privileged server client, loaded inside the handler. Approve sets status + `reviewed_at`; correct-and-approve updates summary, upserts `story_tags`, replaces `story_topics`, sets status `corrected`.
- Keep `robots: noindex` in the route head; leave `src/routes/_authenticated/route.tsx` in place for future gated pages.
