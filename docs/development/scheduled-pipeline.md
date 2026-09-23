# Daily news pipeline

`.github/workflows/pipeline.yml` runs the ingestion worker once daily at 13:05
`Europe/Malta` time, including daylight-saving changes. GitHub Actions may start a
scheduled run late under load; check the Actions history if an expected email is
missing. The workflow also supports a manual email-only test that does not ingest
stories or use the OpenAI API. The test checks the hosted database connection
before sending the email.

The worker uses a rolling 48-hour publication window. Deferred/failed items older
than that window remain in the database for an explicit historical run but do not
consume the daily request budget. The batch is capped at 100 model requests.
After the storage transaction commits, `src.storage.daily` sends an editor-only
plain-text report through Resend. It includes publication and review counts,
failures, filtered and deferred URLs, token counts, estimated model cost, and a
direct link to `/review`. A failed batch sends a failure report when Resend is
available. Usage from failed model responses is not yet captured, so estimated
cost may be lower than billed cost.

Repository Actions secrets:

- `DATABASE_URL`
- `OPENAI_API_KEY`
- `RESEND_API_KEY`

Repository Actions variables:

- `NEWSLETTER_FROM`: verified sender address on the Resend domain
- `PIPELINE_REPORT_TO`: private editor email
- `PIPELINE_REVIEW_URL`: full URL of the hosted review page

Do not put these secrets in the workflow file or frontend variables. To test the
email path, open **Actions → Daily AI news pipeline → Run workflow** and enable
**Send a test report without ingesting news**. To run an extra news batch, leave
that option off. The Supabase `pipeline_runs` table retains the run metrics.
