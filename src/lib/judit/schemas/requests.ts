import "server-only";

import { z } from "zod";

// Response schemas for the requests service
// (https://requests.production.judit.io). Loose objects: unknown fields are
// kept for diagnosis and never break parsing.

// Statuses documented in the OpenAPI spec for a request. Kept as a list, not
// a closed enum in the schema, so an undocumented new status does not break
// parsing; code that branches on status should use these constants.
export const REQUEST_STATUSES = [
  "pending",
  "started",
  "cancelling",
  "cancelled",
  "completed",
] as const;

export type KnownRequestStatus = (typeof REQUEST_STATUSES)[number];

// One request (POST /requests, GET /requests/{id}, items of GET /requests).
// `request_id` and `status` are required in the OpenAPI spec and present in
// every example; without them the request cannot be followed.
export const requestSchema = z.looseObject({
  request_id: z.string(),
  status: z.string(),
  search: z
    .looseObject({
      search_type: z.string().optional(),
      search_key: z.string().optional(),
      response_type: z.string().optional(),
    })
    .optional(),
  origin: z.string().optional(),
  origin_id: z.string().optional(),
  with_attachments: z.boolean().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  completed_at: z.string().optional(),
});

export type JuditRequestRecord = z.infer<typeof requestSchema>;

// Offset pagination (https://docs.judit.io/essentialConcepts/pagination):
//   page            current page, 1-based
//   page_count      items in THIS page (not the number of pages)
//   all_pages_count total number of pages
//   all_count       total number of items across all pages
// Both the pagination page and the OpenAPI spec say these are always present.
function paginated<Item extends z.ZodType>(item: Item) {
  return z.looseObject({
    page: z.number(),
    page_count: z.number(),
    all_pages_count: z.number(),
    all_count: z.number(),
    page_data: z.array(item),
  });
}

export const requestListSchema = paginated(requestSchema);

// One response item (GET /responses/{id}, items of GET /responses and
// GET /responses/tracking/{origin_id}). `response_data` depends on
// `response_type` ("lawsuit", "lawsuits", "entity", "application_error", ...)
// so it stays unknown here; callers parse it per type.
export const responseItemSchema = z.looseObject({
  response_id: z.string(),
  request_id: z.string().optional(),
  response_type: z.string(),
  response_data: z.unknown(),
  origin: z.string().optional(),
  origin_id: z.string().optional(),
  created_at: z.string().optional(),
  request_created_at: z.string().optional(),
  // "Did this come from the datalake?" appears in different places depending
  // on the source; see responseCameFromCache below.
  cached: z.boolean().optional(),
  cached_response: z.boolean().optional(),
  tags: z
    .looseObject({
      cached: z.boolean().optional(),
      cached_response: z.boolean().optional(),
    })
    .optional(),
});

export type ResponseItem = z.infer<typeof responseItemSchema>;

// GET /responses and GET /responses/tracking/{origin_id}. The examples also
// carry `request_status` at the top level, which the OpenAPI spec omits.
export const responseListSchema = paginated(responseItemSchema).extend({
  request_status: z.string().optional(),
});

export type ResponseList = z.infer<typeof responseListSchema>;

// Cached vs fresh: when a request is created, JUDIT first answers from its
// datalake (cached = true) and, in parallel, goes to the court. If the court
// has changes, a second response arrives with cached = false: that one is the
// most current. So two "identical" responses for one request are normal.
// (https://docs.judit.io/requests/requests, "Resposta em cache")
//
// The field location is inconsistent in the docs: `page_data[].cached_response`
// in the page table, `cached` at the item root in the OpenAPI spec, and both
// inside `tags` in the page's own example. We check all four, in that order.
// `undefined` means JUDIT did not say.
export function responseCameFromCache(item: ResponseItem): boolean | undefined {
  return (
    item.cached_response ??
    item.cached ??
    item.tags?.cached_response ??
    item.tags?.cached
  );
}
