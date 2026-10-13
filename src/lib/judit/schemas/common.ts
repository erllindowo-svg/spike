import "server-only";

import { z } from "zod";

// Loose objects keep unknown fields: an extra field from JUDIT must never
// break parsing. Everything is optional unless the docs guarantee it.

// HTTP error bodies. The docs show two shapes
// (https://docs.judit.io/resource/errors, /introduction/authentication,
// /essentialConcepts/rate-limits):
//   nested: { "error": { "name", "message", "data" } }
//   flat:   { "error": "Forbidden", "message": "...", "code": ... }
// The errors page says the nested one is "always" used, but 403 and 429
// examples are flat, so we accept both.
export const httpErrorBodySchema = z.looseObject({
  error: z
    .union([
      z.looseObject({
        name: z.string().optional(),
        message: z.string().optional(),
        data: z.unknown().optional(),
      }),
      z.string(),
    ])
    .optional(),
  message: z.string().optional(),
  code: z.union([z.string(), z.number()]).optional(),
});

// One response item with `response_type: "application_error"`.
// `response_data.code` is a string in the errors page ("LAWSUIT_NOT_FOUND")
// but `number` in the OpenAPI spec for /responses, so we accept both.
export const applicationErrorSchema = z.looseObject({
  response_type: z.literal("application_error"),
  response_data: z
    .looseObject({
      code: z.union([z.string(), z.number()]).optional(),
      message: z.string().optional(),
    })
    .optional(),
});

export type ApplicationErrorItem = z.infer<typeof applicationErrorSchema>;
