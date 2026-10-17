import { z } from "zod";

import {
  buildJuditCallbackUrl,
  getWebhookToken,
} from "@/features/webhooks/callback";
import {
  devJuditRoutesEnabled,
  errorResponse,
  notFoundResponse,
  readInput,
  readQuery,
} from "@/lib/judit/dev-route";
import { createRequest, listRequests } from "@/lib/judit/requests";
import { lawsuitFilterSchema } from "@/lib/judit/schemas/lawsuits";

// Development-only manual tests for POST /requests (step 1 of the async
// flow) and GET /requests (history). See dev-route.ts for why these answer
// 404 outside development.
//
// `callbackOrigin` (optional) is the public https origin of the tunnel, e.g.
// https://xxxx.trycloudflare.com. The server turns it into the callback_url
// with the webhook token, so the secret never goes through the terminal.

const createSchema = z.strictObject({
  searchType: z.enum(["cpf", "cnpj", "oab", "name", "lawsuit_cnj"]),
  searchKey: z.string().min(1),
  onDemand: z.boolean().optional(),
  cacheTtlInDays: z.int().positive().optional(),
  withAttachments: z.boolean().optional(),
  withInferredParties: z.boolean().optional(),
  lawsuitInstance: z.int().positive().optional(),
  filter: lawsuitFilterSchema.optional(),
  callbackOrigin: z
    .url()
    .refine((url) => url.startsWith("https://"), {
      message: "Use uma URL https://",
    })
    .optional(),
});

export async function POST(request: Request) {
  if (!devJuditRoutesEnabled()) return notFoundResponse();

  const input = await readInput(request, createSchema);
  if (!input.ok) return input.response;

  const { callbackOrigin, ...params } = input.data;

  try {
    // Checked before calling JUDIT: otherwise the webhook route would answer
    // 404 to every delivery of this (billable) request.
    const webhookProblem = !callbackOrigin
      ? null
      : !getWebhookToken()
        ? "JUDIT_WEBHOOK_TOKEN não configurado"
        : null;
    if (webhookProblem) {
      return Response.json(
        {
          error: {
            kind: "invalid_input",
            issues: [`callbackOrigin: ${webhookProblem}`],
          },
        },
        { status: 400 },
      );
    }

    const callbackUrl = callbackOrigin
      ? buildJuditCallbackUrl(callbackOrigin)
      : undefined;
    return Response.json(await createRequest({ ...params, callbackUrl }), {
      status: 201,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

// ?created_at_gte=...&created_at_lte=...&page=1&page_size=10
const listSchema = z.strictObject({
  created_at_gte: z.iso.datetime(),
  created_at_lte: z.iso.datetime(),
  page: z.coerce.number().int().min(1).optional(),
  page_size: z.coerce.number().int().min(5).max(100).optional(),
});

export async function GET(request: Request) {
  // Read the request before anything else so this GET is never prerendered.
  const query = readQuery(request, listSchema);
  if (!devJuditRoutesEnabled()) return notFoundResponse();
  if (!query.ok) return query.response;

  try {
    return Response.json(
      await listRequests({
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
