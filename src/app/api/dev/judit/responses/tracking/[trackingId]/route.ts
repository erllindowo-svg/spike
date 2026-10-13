import type { NextRequest } from "next/server";
import { z } from "zod";

import {
  devJuditRoutesEnabled,
  errorResponse,
  notFoundResponse,
  readQuery,
} from "@/lib/judit/dev-route";
import { listTrackingResponses } from "@/lib/judit/requests";

// Development-only manual test for GET /responses/tracking/{origin_id}. See
// dev-route.ts for why this answers 404 outside development.
// ?created_at_gte=...&created_at_lte=...&page=1&page_size=50
const querySchema = z.strictObject({
  created_at_gte: z.iso.datetime(),
  created_at_lte: z.iso.datetime(),
  page: z.coerce.number().int().min(1).optional(),
  page_size: z.coerce.number().int().min(1).max(1000).optional(),
});

export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/dev/judit/responses/tracking/[trackingId]">,
) {
  const query = readQuery(request, querySchema);
  const { trackingId } = await ctx.params;
  if (!devJuditRoutesEnabled()) return notFoundResponse();
  if (!query.ok) return query.response;

  try {
    return Response.json(
      await listTrackingResponses({
        trackingId,
        createdAtGte: query.data.created_at_gte,
        createdAtLte: query.data.created_at_lte,
        page: query.data.page,
        pageSize: query.data.page_size,
      }),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
