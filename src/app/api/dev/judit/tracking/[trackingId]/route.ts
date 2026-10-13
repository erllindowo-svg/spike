import type { NextRequest } from "next/server";
import { z } from "zod";

import {
  devJuditRoutesEnabled,
  errorResponse,
  notFoundResponse,
  readInput,
  readQuery,
} from "@/lib/judit/dev-route";
import {
  deleteTracking,
  getTracking,
  updateTrackingRecurrence,
} from "@/lib/judit/tracking";

// Development-only manual tests for GET, PATCH and DELETE
// /tracking/{tracking_id}. See dev-route.ts for why these answer 404
// outside development.

type Context = RouteContext<"/api/dev/judit/tracking/[trackingId]">;

export async function GET(_request: NextRequest, ctx: Context) {
  const { trackingId } = await ctx.params;
  if (!devJuditRoutesEnabled()) return notFoundResponse();

  try {
    return Response.json(await getTracking(trackingId));
  } catch (error) {
    return errorResponse(error);
  }
}

const patchSchema = z.strictObject({ recurrence: z.int().min(1) });

export async function PATCH(request: NextRequest, ctx: Context) {
  const { trackingId } = await ctx.params;
  if (!devJuditRoutesEnabled()) return notFoundResponse();

  const input = await readInput(request, patchSchema);
  if (!input.ok) return input.response;

  try {
    return Response.json(
      await updateTrackingRecurrence(trackingId, input.data.recurrence),
    );
  } catch (error) {
    return errorResponse(error);
  }
}

// Deleting is permanent, so the caller must add ?confirm=delete. This only
// guards against a mistyped curl; it is not authorization.
const deleteSchema = z.strictObject({ confirm: z.literal("delete") });

export async function DELETE(request: NextRequest, ctx: Context) {
  const { trackingId } = await ctx.params;
  if (!devJuditRoutesEnabled()) return notFoundResponse();

  const query = readQuery(request, deleteSchema);
  if (!query.ok) return query.response;

  try {
    return Response.json(await deleteTracking(trackingId));
  } catch (error) {
    return errorResponse(error);
  }
}
