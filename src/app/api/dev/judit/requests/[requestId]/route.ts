import type { NextRequest } from "next/server";

import {
  devJuditRoutesEnabled,
  errorResponse,
  notFoundResponse,
} from "@/lib/judit/dev-route";
import { getRequest } from "@/lib/judit/requests";

// Development-only manual test for GET /requests/{request_id} (step 2 of
// the async flow: status polling). See dev-route.ts for why this answers 404
// outside development.
export async function GET(
  _request: NextRequest,
  ctx: RouteContext<"/api/dev/judit/requests/[requestId]">,
) {
  const { requestId } = await ctx.params;
  if (!devJuditRoutesEnabled()) return notFoundResponse();

  try {
    return Response.json(await getRequest(requestId));
  } catch (error) {
    return errorResponse(error);
  }
}
