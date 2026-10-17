import { z } from "zod";

import { listRecentWebhookEvents } from "@/features/webhooks/db";
import { notFoundResponse, readQuery } from "@/lib/judit/dev-route";

// Development-only: the latest webhook deliveries stored by
// src/app/api/webhooks/judit, to check a real test without opening Atlas.
// No JUDIT call, so it does not need the kill switch; it needs the "db" mode.
// What it shows was already reduced and had the token masked before being
// stored. Reachable only from this machine (src/proxy.ts blocks the tunnel).
// ?limit=10

const querySchema = z.strictObject({
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export async function GET(request: Request) {
  // Read the request before anything else so this GET is never prerendered.
  const query = readQuery(request, querySchema);
  if (process.env.NODE_ENV !== "development") return notFoundResponse();
  if (!query.ok) return query.response;

  return Response.json(await listRecentWebhookEvents(query.data.limit ?? 10));
}
