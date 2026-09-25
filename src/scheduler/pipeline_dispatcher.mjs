/** Dispatch the existing GitHub pipeline at 13:05 Europe/Malta. */

const WORKFLOW_URL =
  "https://api.github.com/repos/sasud283/ai-news-feed/actions/workflows/pipeline.yml/dispatches";
const maltaClock = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Malta",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function isPipelineTime(scheduledTime) {
  const parts = Object.fromEntries(
    maltaClock.formatToParts(new Date(scheduledTime)).map(({ type, value }) => [type, value]),
  );
  return parts.hour === "13" && parts.minute === "05";
}

export async function dispatchPipeline(scheduledTime, token, fetchImpl = fetch) {
  if (!isPipelineTime(scheduledTime)) return false;
  if (!token) throw new Error("GitHub dispatch credential is missing");
  const response = await fetchImpl(WORKFLOW_URL, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "thefullpicture-ai-scheduler",
      "X-GitHub-Api-Version": "2026-03-10",
    },
    body: JSON.stringify({ ref: "main" }),
  });
  if (!response.ok) throw new Error(`GitHub workflow dispatch failed: HTTP ${response.status}`);
  return true;
}

export default {
  async scheduled(controller, env) {
    const dispatched = await dispatchPipeline(controller.scheduledTime, env.GITHUB_DISPATCH_TOKEN);
    console.log(JSON.stringify({ event: "pipeline_dispatch", dispatched }));
  },
  fetch() {
    return new Response("Not found", { status: 404 });
  },
};
