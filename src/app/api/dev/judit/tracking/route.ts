import { z } from "zod";

import {
  devJuditRoutesEnabled,
  errorResponse,
  notFoundResponse,
  readInput,
  readQuery,
} from "@/lib/judit/dev-route";
import { lawsuitFilterSchema } from "@/lib/judit/schemas/lawsuits";
import { createTracking, listTrackings } from "@/lib/judit/tracking";

// Development-only manual tests for POST /tracking and GET /tracking. See
// dev-route.ts for why these answer 404 outside development.

const createSchema = z.strictObject({
  searchType: z.enum(["lawsuit_cnj", "cpf", "cnpj", "oab"]),
  searchKey: z.string().min(1),
  recurrence: z.int().min(1),
  withAttachments: z.boolean().optional(),
  lawsuitInstance: z.int().positive().optional(),
  withInferredParties: z.boolean().optional(),
  filter: lawsuitFilterSchema.optional(),
});

export async function POST(request: Request) {
  if (!devJuditRoutesEnabled()) return notFoundResponse();

  const input = await readInput(request, createSchema);
  if (!input.ok) return input.response;

  try {
    return Response.json(await createTracking(input.data), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

// ?page=1&page_size=10
const listSchema = z.strictObject({
  page: z.coerce.number().int().min(1).optional(),
  page_size: z.coerce.number().int().min(5).max(1000).optional(),
});

export async function GET(request: Request) {
  // Read the request before anything else so this GET is never prerendered.
  const query = readQuery(request, listSchema);
  if (!devJuditRoutesEnabled()) return notFoundResponse();
  if (!query.ok) return query.response;

  try {
    return Response.json(
      await listTrackings({
        page: query.data.page,
        pageSize: query.data.page_size,
      }),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
