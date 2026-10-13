import { z } from "zod";

import {
  devJuditRoutesEnabled,
  errorResponse,
  notFoundResponse,
  readInput,
} from "@/lib/judit/dev-route";
import { searchLawsuits } from "@/lib/judit/lawsuits";
import { lawsuitFilterSchema } from "@/lib/judit/schemas/lawsuits";

// Development-only manual test for POST /lawsuits (hot storage). See
// dev-route.ts for why this answers 404 outside development.
const inputSchema = z.strictObject({
  searchType: z.enum(["cpf", "cnpj", "oab", "name", "lawsuit_cnj"]),
  searchKey: z.string().min(1),
  filter: lawsuitFilterSchema.optional(),
  withInferredParties: z.boolean().optional(),
  onDemand: z.boolean().optional(),
  cacheTtlInDays: z.int().positive().optional(),
});

export async function POST(request: Request) {
  if (!devJuditRoutesEnabled()) return notFoundResponse();

  const input = await readInput(request, inputSchema);
  if (!input.ok) return input.response;

  try {
    return Response.json(await searchLawsuits(input.data));
  } catch (error) {
    return errorResponse(error);
  }
}
