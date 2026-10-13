import { z } from "zod";

import {
  devJuditRoutesEnabled,
  errorResponse,
  notFoundResponse,
  readInput,
} from "@/lib/judit/dev-route";
import { getEntity } from "@/lib/judit/lawsuits";

// Development-only manual test for POST /entities. See dev-route.ts for why
// this answers 404 outside development.
const inputSchema = z.strictObject({
  searchType: z.enum(["cpf", "cnpj", "name"]),
  searchKey: z.string().min(1),
  onDemand: z.boolean().optional(),
  revealPartnersDocuments: z.boolean().optional(),
});

export async function POST(request: Request) {
  if (!devJuditRoutesEnabled()) return notFoundResponse();

  const input = await readInput(request, inputSchema);
  if (!input.ok) return input.response;

  try {
    return Response.json(await getEntity(input.data));
  } catch (error) {
    return errorResponse(error);
  }
}
