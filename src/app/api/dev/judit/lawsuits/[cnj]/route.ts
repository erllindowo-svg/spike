import type { NextRequest } from "next/server";

import {
  devJuditRoutesEnabled,
  errorResponse,
  notFoundResponse,
} from "@/lib/judit/dev-route";
import { getLawsuitByCnj } from "@/lib/judit/lawsuits";

// Development-only manual test for GET /lawsuits/{lawsuit_cnj}. See
// dev-route.ts for why this answers 404 outside development.
// Optional query: ?instance=1
export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/dev/judit/lawsuits/[cnj]">,
) {
  // Reading the request first also keeps Cache Components from trying to
  // prerender this GET at build time.
  const instanceParam = request.nextUrl.searchParams.get("instance");
  if (!devJuditRoutesEnabled()) return notFoundResponse();

  const instance = instanceParam === null ? undefined : Number(instanceParam);
  if (instance !== undefined && !(Number.isInteger(instance) && instance > 0)) {
    return Response.json(
      {
        error: {
          kind: "invalid_input",
          issues: ["instance: inteiro positivo"],
        },
      },
      { status: 400 },
    );
  }

  const { cnj } = await ctx.params;
  try {
    return Response.json(await getLawsuitByCnj({ cnj, instance }));
  } catch (error) {
    return errorResponse(error);
  }
}
