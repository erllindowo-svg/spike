import type { NextRequest } from "next/server";

import {
  devJuditRoutesEnabled,
  errorResponse,
  notFoundResponse,
} from "@/lib/judit/dev-route";
import { getResponse } from "@/lib/judit/requests";

// Development-only manual test for GET /responses/{response_id}. See
// dev-route.ts for why this answers 404 outside development.
export async function GET(
  _request: NextRequest,
  ctx: RouteContext<"/api/dev/judit/responses/[responseId]">,
) {
  const { responseId } = await ctx.params;
  if (!devJuditRoutesEnabled()) return notFoundResponse();

  try {
    return Response.json(await getResponse(responseId));
  } catch (error) {
    return errorResponse(error);
  }
}
