import "server-only";

import { juditRequest } from "./client";
import { assertAllowedSearchKey } from "./guard";
import type { LawsuitFilter } from "./schemas/lawsuits";
import { trackingListSchema, trackingSchema } from "./schemas/tracking";

// Tracking service (https://tracking.production.judit.io): recurring
// monitoring. A request (requests.ts) runs once; a tracking keeps running
// every `recurrence` days until it is paused or deleted.
//
// Two kinds, chosen by search_type:
// - "lawsuit_cnj": watches ONE known lawsuit for new steps (movimentações).
//   https://docs.judit.io/tracking/tracking
// - "cpf" | "cnpj" | "oab": watches a document for NEW lawsuits that did not
//   exist when monitoring started ("nascimento de novos processos").
//   The docs say these runs are always on-demand and ask to check the cost
//   conditions first. https://docs.judit.io/tracking/tracking-document
//
// Timing: creating a tracking does not query the court. The first run
// happens "na melhor janela de concorrência", within 24 hours of creation
// (JUDIT spreads court load; `hour_range` in the response tells the hour).
// So right after creating, there are no results yet, and that is expected.
// Results arrive by webhook (out of scope) or via
// listTrackingResponses(tracking_id) in requests.ts.
//
// Cost: an active tracking keeps generating runs, and therefore cost, until
// paused or deleted. Never retry createTracking automatically: a duplicate
// tracking doubles the recurring cost (see client.ts).

export async function createTracking(params: {
  searchType: "lawsuit_cnj" | "cpf" | "cnpj" | "oab";
  searchKey: string;
  // Days between runs. No default on purpose: it drives the recurring cost.
  recurrence: number;
  withAttachments?: boolean;
  // CNJ only: without it, all instances of the number are returned.
  lawsuitInstance?: number;
  // Documents only.
  withInferredParties?: boolean;
  filter?: LawsuitFilter;
}) {
  const searchKey = params.searchKey.trim();
  assertAllowedSearchKey(params.searchType, searchKey);

  const searchParams = {
    ...(params.lawsuitInstance !== undefined
      ? { lawsuit_instance: params.lawsuitInstance }
      : {}),
    ...(params.withInferredParties ? { with_inferred_parties: true } : {}),
    ...(params.filter ? { filter: params.filter } : {}),
  };

  return juditRequest({
    service: "tracking",
    method: "POST",
    path: "/tracking",
    body: {
      recurrence: params.recurrence,
      // The CNJ page marks fixed_time as required but its examples omit it;
      // the OpenAPI spec requires it with default false. Sending false
      // satisfies both and keeps JUDIT choosing the best time window.
      fixed_time: false,
      search: {
        search_type: params.searchType,
        search_key: searchKey,
        ...(Object.keys(searchParams).length > 0
          ? { search_params: searchParams }
          : {}),
      },
      ...(params.withAttachments ? { with_attachments: true } : {}),
    },
    schema: trackingSchema,
  });
}

// GET /tracking: list of trackings. The OpenAPI spec marks page and
// page_size (5 to 1000) as required. Filters (status, search_type, ...) are
// array params whose query format the docs do not pin down, so they are not
// exposed yet.
export async function listTrackings(params: {
  page?: number;
  pageSize?: number;
}) {
  return juditRequest({
    service: "tracking",
    method: "GET",
    path: "/tracking",
    query: { page: params.page ?? 1, page_size: params.pageSize ?? 10 },
    schema: trackingListSchema,
  });
}

// GET /tracking/{tracking_id}
export async function getTracking(trackingId: string) {
  return juditRequest({
    service: "tracking",
    method: "GET",
    path: trackingPath(trackingId),
    schema: trackingSchema,
  });
}

// PATCH /tracking/{tracking_id}. The pages say recurrence, tags and search
// can be updated; the OpenAPI spec only lists notification_emails and
// callback_url. Only recurrence is exposed until a live call confirms it
// (see README). Changing `search` is not exposed: it would bypass the
// allowlist check done at creation.
export async function updateTrackingRecurrence(
  trackingId: string,
  recurrence: number,
) {
  return juditRequest({
    service: "tracking",
    method: "PATCH",
    path: trackingPath(trackingId),
    body: { recurrence },
    schema: trackingSchema,
  });
}

// POST /tracking/{tracking_id}/pause: stops future runs, keeps the tracking.
export async function pauseTracking(trackingId: string) {
  return juditRequest({
    service: "tracking",
    method: "POST",
    path: `${trackingPath(trackingId)}/pause`,
    schema: trackingSchema,
  });
}

// POST /tracking/{tracking_id}/resume: reactivates a paused tracking. The
// example returns status "updated", not "created".
export async function resumeTracking(trackingId: string) {
  return juditRequest({
    service: "tracking",
    method: "POST",
    path: `${trackingPath(trackingId)}/resume`,
    schema: trackingSchema,
  });
}

// DELETE /tracking/{tracking_id}. Permanent, per the docs: future runs are
// cancelled and past responses stay reachable only through GET /responses
// with the old origin_id. Prefer pause when in doubt.
export async function deleteTracking(trackingId: string) {
  return juditRequest({
    service: "tracking",
    method: "DELETE",
    path: trackingPath(trackingId),
    schema: trackingSchema,
  });
}

function trackingPath(trackingId: string) {
  return `/tracking/${encodeURIComponent(trackingId)}`;
}
