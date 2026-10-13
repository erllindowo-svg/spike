import type { NextRequest } from "next/server";

import {
  devJuditRoutesEnabled,
  errorResponse,
  notFoundResponse,
} from "@/lib/judit/dev-route";
import { resumeTracking } from "@/lib/judit/tracking";

// Development-only manual test for POST /tracking/{tracking_id}/resume. See
// dev-route.ts for why this answers 404 outside development.
export async function POST(
  _request: NextRequest,
  ctx: RouteContext<"/api/dev/judit/tracking/[trackingId]/resume">,
) {
  const { trackingId } = await ctx.params;
  if (!devJuditRoutesEnabled()) return notFoundResponse();

  try {
    return Response.json(await resumeTracking(trackingId));
  } catch (error) {
    return errorResponse(error);
  }
}
