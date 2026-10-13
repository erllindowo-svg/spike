import "server-only";

import { z } from "zod";

// Response schemas for the tracking service
// (https://tracking.production.judit.io).

// Statuses documented for a tracking. The pages list created, updating,
// updated, paused and deleted; the OpenAPI spec adds "suspended". Kept as a
// list, not a closed enum, so a new status does not break parsing.
export const TRACKING_STATUSES = [
  "created",
  "updating",
  "updated",
  "paused",
  "deleted",
  "suspended",
] as const;

export type KnownTrackingStatus = (typeof TRACKING_STATUSES)[number];

// One tracking, as returned by create, get, pause, resume, update and delete
// (all share the same shape in the OpenAPI spec and the page examples).
export const trackingSchema = z.looseObject({
  tracking_id: z.string(),
  status: z.string(),
  // Days between runs. Required in the OpenAPI response, present in every
  // example; optional here because the create page does not mark it
  // required in the request.
  recurrence: z.number().optional(),
  search: z
    .looseObject({
      search_type: z.string().optional(),
      search_key: z.string().optional(),
      response_type: z.string().optional(),
    })
    .optional(),
  with_attachments: z.boolean().optional(),
  // Hour of day (0-23) of the first court query, per the create page note.
  hour_range: z.number().optional(),
  tracked_items_count: z.number().optional(),
  tracked_items_steps_count: z.number().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  paused_at: z.string().optional(),
  deleted_at: z.string().optional(),
});

export type Tracking = z.infer<typeof trackingSchema>;

// GET /tracking: offset pagination, same fields as the requests service
// (page, page_count = items in this page, all_pages_count, all_count).
export const trackingListSchema = z.looseObject({
  page: z.number(),
  page_count: z.number(),
  all_pages_count: z.number(),
  all_count: z.number(),
  page_data: z.array(trackingSchema),
});
