# Pipeline scheduler cutover

GitHub's native scheduled runs have started hours after the configured 13:05
Europe/Malta time. The pipeline itself and its completion email stay in the
existing GitHub Actions workflow. A small Cloudflare Worker dispatches that
workflow using a fine-grained GitHub token instead of relying on GitHub's cron.

The Worker has two UTC triggers, at 11:05 and 12:05. It dispatches only when the
trigger represents 13:05 in Europe/Malta, covering daylight saving time without
manual clock changes. It has no public HTTP API. The two-trigger approach uses
two tiny Worker invocations per day and one GitHub dispatch.

## Activation

1. Deploy `wrangler.pipeline-scheduler.bootstrap.json`. It creates the Worker
   without any active cron triggers.
2. Create a fine-grained GitHub personal access token scoped only to
   `sasud283/ai-news-feed`, with **Actions: Read and write** permission and a
   short expiry. Save it as the Worker's `GITHUB_DISPATCH_TOKEN` secret; never
   put it in the repository or chat.
3. Deploy `wrangler.pipeline-scheduler.json` to activate the triggers.
4. Verify one Cloudflare Cron event and its matching GitHub Actions dispatch.
   Then remove the native `schedule` block from `.github/workflows/pipeline.yml`.
   Keep `workflow_dispatch` so the Cloudflare Worker can trigger the workflow.
5. Monitor for a missing run or missing report email, and rotate the token before
   expiry. A failed dispatch must alert the owner rather than silently vanish.

Cloudflare Cron is a more direct trigger but is still not a real-time guarantee.
The worker logs dispatch success/failure without logging its credential.
