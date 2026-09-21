/** Pre-launch indexing policy. Remove only when the owner approves indexing. */
export const INDEXING_POLICY = "noindex, nofollow, noarchive";

/** Cover SSR pages, API responses, redirects and error responses. */
export function preventIndexing(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("X-Robots-Tag", INDEXING_POLICY);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
