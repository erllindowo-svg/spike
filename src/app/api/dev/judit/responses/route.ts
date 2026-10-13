import { z } from "zod";

import {
  devJuditRoutesEnabled,
  errorResponse,
  notFoundResponse,
  readQuery,
} from "@/lib/judit/dev-route";
import { listResponses } from "@/lib/judit/requests";

// Development-only manual test for GET /responses (step 3 of the async
// flow). See dev-route.ts for why this answers 404 outside development.
// ?request_id=...&page=1&page_size=100
const querySchema = z.strictObject({
  request_id: z.string().min(1),
  page: z.coerce.number().int().min(1).optional(),
  page_size: z.coerce.number().int().min(5).max(1000).optional(),
});

export async function GET(request: Request) {
  // Read the request before anything else so this GET is never prerendered.
  const query = readQuery(request, querySchema);
  if (!devJuditRoutesEnabled()) return notFoundResponse();
  if (!query.ok) return query.response;

  try {
    return Response.json(
      await listResponses({
        requestId: query.data.request_id,
        page: query.data.page,
        pageSize: query.data.page_size,
      }),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
