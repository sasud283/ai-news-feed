// An isolated, in-memory PostgreSQL engine; never connects to the live project.
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { createInterface } from "node:readline";
const db = new PGlite();
await db.exec(`
  CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
  CREATE SCHEMA auth;
  CREATE TABLE auth.users(id uuid PRIMARY KEY, email text);
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
    $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  GRANT USAGE ON SCHEMA auth TO anon, authenticated;
`);
for (const name of [
  "0000_create_ai_news_schema",
  "0001_first_user_becomes_admin",
  "0002_add_story_content_media",
  "0003_ingestion_storage",
  "0004_explicit_admin_assignment",
  "0005_editorial_tones",
  "0006_newsletter",
  "0007_split_work_topics",
  "0008_add_story_language",
  "0009_pipeline_run_reports",
  "0010_education_multi_region_admin_edits",
  "0011_society_economy_oceania",
  "0012_admin_content_type_editing",
]) {
  const sql = await readFile(`drizzle/migrations/${name}.sql`, "utf8");
  await db.transaction(async (tx) => tx.exec(sql));
}
console.log(JSON.stringify({ ready: true }));
for await (const line of createInterface({ input: process.stdin })) {
  try {
    const { sql, args, script } = JSON.parse(line);
    const result = script ? await db.exec(sql) : await db.query(sql, args);
    console.log(JSON.stringify({ rows: script ? [] : result.rows }));
  } catch (error) {
    console.log(JSON.stringify({ error: error.message }));
  }
}
await db.close();
