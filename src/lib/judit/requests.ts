import "server-only";

import { juditRequest } from "./client";
import { assertAllowedSearchKey } from "./guard";
import type { LawsuitFilter } from "./schemas/lawsuits";
import {
  requestListSchema,
  requestSchema,
  responseItemSchema,
  responseListSchema,
} from "./schemas/requests";

// Requests service (https://requests.production.judit.io): the asynchronous
// flow. Unlike the lawsuits service, the answer does NOT come in the body of
// the call that starts the work. The lifecycle is:
//
//   1. createRequest      POST /requests          -> { request_id, status: "pending" }
//      JUDIT accepted the job. Nothing is done yet.
//   2. getRequest         GET /requests/{id}      -> status: pending -> started -> completed
//      Polling: ask again later until status is "completed" (or "cancelled").
//   3. listResponses      GET /responses?request_id=...
//      The results. They are inserted incrementally while robots work, so
//      some may exist before "completed"; only "completed" means the set is
//      final. There can be a cached result first and a fresh one later (see
//      responseCameFromCache in schemas/requests.ts).
//
// Webhooks replace steps 2 and 3 when the request carries a `callback_url`:
// JUDIT then POSTs each response to the app (src/app/api/webhooks/judit).
// Polling keeps working either way. Nothing in this module polls automatically: each GET is a request against
// the rate limit, and the docs do not say whether status checks are billed.
// Docs: https://docs.judit.io/requests/requests (by CNJ) and
// https://docs.judit.io/requests/request-document (by document).

// POST /requests. Billable ("Cobrança por requisição"). Creates work on
// JUDIT's side, so it is never retried automatically (see client.ts).
// Not exposed on purpose: `should_search_superior_instances` (+30% cost) and
// `customer_key` (credential vault).
export async function createRequest(params: {
  // "rji" (BNMP number) only with responseType "warrant"
  // (https://docs.judit.io/criminal-consultation/warrant).
  searchType: "cpf" | "cnpj" | "oab" | "name" | "rji" | "lawsuit_cnj";
  searchKey: string;
  // What comes back: lawsuits (default), arrest warrants
  // (https://docs.judit.io/criminal-consultation/warrant) or penal executions
  // (https://docs.judit.io/criminal-consultation/criminal-execution). Both
  // pages put it inside `search`.
  responseType?: "lawsuit" | "warrant" | "execution";
  // AI features on the result (beta). ["summary"] adds a written summary
  // as one more item of the responses (https://docs.judit.io/requests/requests).
  juditIa?: "summary"[];
  // Forces a real-time court search instead of the datalake (documents).
  onDemand?: boolean;
  // Accept a cached result if the last extraction is at most N days old.
  cacheTtlInDays?: number;
  // Downloads up to 1,000 attachments. Changes the cost; see the docs page
  // section "Como funcionam os anexos" before enabling.
  withAttachments?: boolean;
  withInferredParties?: boolean;
  lawsuitInstance?: number;
  filter?: LawsuitFilter;
  // Where JUDIT delivers each response of this request (webhook), at the top
  // level of the body (https://docs.judit.io/webhook/callbacks). Build it
  // with buildJuditCallbackUrl (src/features/webhooks/callback.ts).
  callbackUrl?: string;
}) {
  const searchKey = params.searchKey.trim();
  assertAllowedSearchKey(params.searchType, searchKey);

  const searchParams = {
    ...(params.filter ? { filter: params.filter } : {}),
    ...(params.withInferredParties ? { with_inferred_parties: true } : {}),
    ...(params.lawsuitInstance !== undefined
      ? { lawsuit_instance: params.lawsuitInstance }
      : {}),
  };

  return juditRequest({
    service: "requests",
    method: "POST",
    path: "/requests",
    body: {
      search: {
        search_type: params.searchType,
        search_key: searchKey,
        ...(params.responseType ? { response_type: params.responseType } : {}),
        ...(params.onDemand ? { on_demand: true } : {}),
        // The request-document table lists cache_ttl_in_days at the top
        // level, but its own example and the OpenAPI spec put it inside
        // `search`. We follow the example and the spec.
        ...(params.cacheTtlInDays !== undefined
          ? { cache_ttl_in_days: params.cacheTtlInDays }
          : {}),
        ...(Object.keys(searchParams).length > 0
          ? { search_params: searchParams }
          : {}),
      },
      ...(params.withAttachments ? { with_attachments: true } : {}),
      ...(params.juditIa?.length ? { judit_ia: params.juditIa } : {}),
      ...(params.callbackUrl ? { callback_url: params.callbackUrl } : {}),
    },
    schema: requestSchema,
  });
}

// GET /requests/{request_id}: current status of one request (step 2).
export async function getRequest(requestId: string) {
  return juditRequest({
    service: "requests",
    method: "GET",
    path: `/requests/${encodeURIComponent(requestId)}`,
    schema: requestSchema,
  });
}

// GET /requests: history of requests. The OpenAPI spec marks
// created_at_gte/created_at_lte, page and page_size as required, with
// page_size between 5 and 100 (the pagination page says max 1000; see
// README).
export async function listRequests(params: {
  createdAtGte: string;
  createdAtLte: string;
  page?: number;
  pageSize?: number;
}) {
  return juditRequest({
    service: "requests",
    method: "GET",
    path: "/requests",
    query: {
      created_at_gte: params.createdAtGte,
      created_at_lte: params.createdAtLte,
      page: params.page ?? 1,
      page_size: params.pageSize ?? 10,
    },
    schema: requestListSchema,
  });
}

// GET /responses?request_id=...: results of one request (step 3).
// An item with response_type "application_error" is a valid result here
// (e.g. LAWSUIT_NOT_FOUND), not a failed call, so the list is returned as is.
export async function listResponses(params: {
  requestId: string;
  page?: number;
  pageSize?: number;
}) {
  return juditRequest({
    service: "requests",
    method: "GET",
    path: "/responses",
    query: {
      request_id: params.requestId,
      page: params.page ?? 1,
      // The docs examples use 100; the OpenAPI spec allows 5 to 1000.
      page_size: params.pageSize ?? 100,
    },
    schema: responseListSchema,
  });
}

// GET /responses/{response_id}: one result. If its response_type is
// "application_error", the client raises JuditApplicationError.
export async function getResponse(responseId: string) {
  return juditRequest({
    service: "requests",
    method: "GET",
    path: `/responses/${encodeURIComponent(responseId)}`,
    schema: responseItemSchema,
  });
}

// GET /responses/tracking/{origin_id}: results produced by a tracking
// (monitoring), where origin_id is the tracking_id. The OpenAPI spec marks
// the created_at range as required.
// Docs: https://docs.judit.io/tracking/tracking
export async function listTrackingResponses(params: {
  trackingId: string;
  createdAtGte: string;
  createdAtLte: string;
  page?: number;
  pageSize?: number;
}) {
  return juditRequest({
    service: "requests",
    method: "GET",
    path: `/responses/tracking/${encodeURIComponent(params.trackingId)}`,
    query: {
      created_at_gte: params.createdAtGte,
      created_at_lte: params.createdAtLte,
      page: params.page ?? 1,
      page_size: params.pageSize ?? 50,
    },
    schema: responseListSchema,
  });
}
