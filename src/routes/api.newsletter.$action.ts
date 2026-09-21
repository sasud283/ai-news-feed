import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/newsletter/$action")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { newsletterRequest } = await import("@/lib/newsletter/api.server");
        return newsletterRequest(request, params.action);
      },
      POST: async ({ request, params }) => {
        const { newsletterRequest } = await import("@/lib/newsletter/api.server");
        return newsletterRequest(request, params.action);
      },
    },
  },
});
