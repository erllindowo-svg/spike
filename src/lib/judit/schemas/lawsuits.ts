import "server-only";

import { z } from "zod";

// Response schemas for the lawsuits service. Only fields we read are typed;
// loose objects keep everything else, so the full JUDIT payload is still
// available for diagnosis. Fields are optional unless the docs guarantee them
// consistently (the OpenAPI "required" lists disagree with the page examples
// in several places, see README).

// Request filter (`search.search_params.filter`), as listed in the OpenAPI
// spec for POST /lawsuits and the count page. Strict on purpose: this is
// input we build, and a typo should fail here instead of being silently
// ignored by JUDIT.
const keysFilter = z.strictObject({
  keys: z.array(z.string()),
  not_equal: z.boolean(),
});
const containsFilter = z.strictObject({
  contains: z.array(z.string()),
  not_contains: z.array(z.string()),
});

export const lawsuitFilterSchema = z.strictObject({
  side: z.enum(["Passive", "Active", "Interested", "Unknown"]).optional(),
  party_names: z.array(z.string()).optional(),
  party_documents: z.array(z.string()).optional(),
  distribution_date_gte: z.iso.datetime().optional(),
  distribution_date_lte: z.iso.datetime().optional(),
  last_step_date_gte: z.iso.datetime().optional(),
  last_step_date_lte: z.iso.datetime().optional(),
  tribunals: keysFilter.optional(),
  classification_codes: keysFilter.optional(),
  classification_names: keysFilter.optional(),
  subject_codes: containsFilter.optional(),
  subject_names: containsFilter.optional(),
  amount_gte: z.number().optional(),
  amount_lte: z.number().optional(),
});

export type LawsuitFilter = z.infer<typeof lawsuitFilterSchema>;

// One lawsuit (https://docs.judit.io/schemas/lawsuit-object). `code` is the
// CNJ number and is the only field we treat as guaranteed: without it the
// item cannot be identified.
export const lawsuitSchema = z.looseObject({
  code: z.string(),
  instance: z.number().optional(),
  name: z.string().optional(),
  tribunal_acronym: z.string().optional(),
  status: z.string().optional(),
  phase: z.string().optional(),
  distribution_date: z.string().optional(),
  amount: z.number().optional(),
  // > 0 means secrecy; most fields then come empty or absent.
  secrecy_level: z.number().optional(),
  last_step: z
    .looseObject({
      step_date: z.string().optional(),
      content: z.string().optional(),
      steps_count: z.number().optional(),
    })
    .optional(),
});

export type Lawsuit = z.infer<typeof lawsuitSchema>;

// POST /lawsuits. The list field name is contradictory in the docs: the
// hot storage page says `response_data`, the OpenAPI spec and the on-demand
// page say `lawsuits`. We accept both and expose a single `lawsuits` list.
export const lawsuitsSearchResponseSchema = z
  .looseObject({
    has_lawsuits: z.boolean().optional(),
    request_id: z.string().optional(),
    lawsuits: z.array(lawsuitSchema).optional(),
    response_data: z.array(lawsuitSchema).optional(),
  })
  .transform(({ lawsuits, response_data, ...rest }) => ({
    ...rest,
    lawsuits: lawsuits ?? response_data ?? [],
  }));

export type LawsuitsSearchResponse = z.infer<
  typeof lawsuitsSearchResponseSchema
>;

// POST /lawsuits/count: `{ "total": <number> }` on the page and required in
// the OpenAPI spec.
export const lawsuitsCountResponseSchema = z.looseObject({
  total: z.number(),
});

// POST /lawsuits/synthetic. Each axis is a list of `{ value, count }`.
// `value` is a string in the OpenAPI spec, but the `instances` axis is
// described as "1 ou 2", so numbers are accepted too.
const bucketSchema = z.looseObject({
  value: z.union([z.string(), z.number()]),
  count: z.number(),
});
const buckets = z.array(bucketSchema).optional();

export const lawsuitsSyntheticResponseSchema = z.looseObject({
  request_id: z.string().optional(),
  lawsuits_count: z.number().optional(),
  secrecy_lawsuits_count: z.number().optional(),
  classifications: buckets,
  subjects: buckets,
  areas: buckets,
  tribunals: buckets,
  justices: buckets,
  phases: buckets,
  states: buckets,
  instances: buckets,
  sides: buckets,
  person_types: buckets,
});

export type LawsuitsSyntheticResponse = z.infer<
  typeof lawsuitsSyntheticResponseSchema
>;

// POST /entities (https://docs.judit.io/schemas/entity). The OpenAPI spec
// marks `partners` as required, but the CPF example has none.
export const entitySchema = z.looseObject({
  entity_type: z.enum(["person", "company"]).optional(),
  name: z.string().optional(),
  social_name: z.string().optional(),
  main_document: z.string().optional(),
  revenue_service_active: z.boolean().optional(),
  revenue_service_status: z.string().optional(),
  special_status: z.string().optional(),
});

export const entitiesResponseSchema = z.looseObject({
  request_id: z.string().optional(),
  response_data: z.array(entitySchema).default([]),
});

export type EntitiesResponse = z.infer<typeof entitiesResponseSchema>;

// GET /lawsuits/{lawsuit_cnj}: a single lawsuit object at the top level.
export const lawsuitByCnjResponseSchema = lawsuitSchema;
