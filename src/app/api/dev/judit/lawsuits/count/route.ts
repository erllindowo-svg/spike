import { z } from "zod";

import {
  devJuditRoutesEnabled,
  errorResponse,
  notFoundResponse,
  readInput,
} from "@/lib/judit/dev-route";
import { countLawsuits } from "@/lib/judit/lawsuits";
import { lawsuitFilterSchema } from "@/lib/judit/schemas/lawsuits";

// Development-only manual test for POST /lawsuits/count. See dev-route.ts
// for why this answers 404 outside development.
const inputSchema = z.strictObject({
  searchType: z.enum(["cpf", "cnpj", "oab", "name", "lawsuit_cnj", "rji"]),
  searchKey: z.string().min(1),
  filter: lawsuitFilterSchema.optional(),
});

export async function POST(request: Request) {
  if (!devJuditRoutesEnabled()) return notFoundResponse();

  const input = await readInput(request, inputSchema);
  if (!input.ok) return input.response;

  try {
    return Response.json(await countLawsuits(input.data));
  } catch (error) {
    return errorResponse(error);
  }
}
