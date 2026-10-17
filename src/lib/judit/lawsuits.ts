import "server-only";

import { juditRequest } from "./client";
import { assertAllowedSearchKey } from "./guard";
import {
  entitiesResponseSchema,
  lawsuitByCnjResponseSchema,
  lawsuitsCountResponseSchema,
  lawsuitsSearchResponseSchema,
  lawsuitsSyntheticResponseSchema,
  type LawsuitFilter,
} from "./schemas/lawsuits";

// Lawsuits service (https://lawsuits.production.judit.io). Every endpoint
// here is synchronous: the answer comes in the body of the same call, with
// no polling. Data comes from JUDIT's datalake (a cache of past court
// collections), so it may lag behind the court. For fresh court data, use the
// async requests service (phase 2).
//
// Search keys are sent exactly as the caller provides them (trimmed). The
// docs only show formatted examples ("999.999.999-99", "A1B2C3D4/E5F6-68"),
// so we do not reformat.

type DocumentSearchType = "cpf" | "cnpj" | "oab" | "name";

// When on_demand triggers a court extraction, the docs say the response can
// take up to 3 minutes (https://docs.judit.io/cache-judit/on-demand).
const ON_DEMAND_TIMEOUT_MS = 180_000;

// POST /entities: registration data (name, status, addresses, partners).
// https://docs.judit.io/registration-data/registration-data
export async function getEntity(params: {
  searchType: "cpf" | "cnpj" | "name";
  searchKey: string;
  // Reads the Federal Revenue in real time. More expensive.
  onDemand?: boolean;
  // Unmasked partner documents. Needs a legal basis (LGPD), per the docs.
  revealPartnersDocuments?: boolean;
}) {
  const searchKey = params.searchKey.trim();
  await assertAllowedSearchKey(params.searchType, searchKey);

  return juditRequest({
    service: "lawsuits",
    method: "POST",
    path: "/entities",
    body: {
      search: {
        search_type: params.searchType,
        search_key: searchKey,
        // The page says it is required and "always entity"; the OpenAPI spec
        // does not list it. Sent to follow the page (see README).
        response_type: "entity",
        ...(params.onDemand ? { on_demand: true } : {}),
        ...(params.revealPartnersDocuments
          ? { reveal_partners_documents: true }
          : {}),
      },
    },
    schema: entitiesResponseSchema,
    timeoutMs: params.onDemand ? ON_DEMAND_TIMEOUT_MS : undefined,
  });
}

// POST /lawsuits: list of lawsuits from the datalake ("hot storage").
// https://docs.judit.io/cache-judit/hotstorage
// With searchType "lawsuit_cnj" and onDemand, JUDIT may go to the court first
// (https://docs.judit.io/cache-judit/on-demand).
export async function searchLawsuits(params: {
  searchType: DocumentSearchType | "lawsuit_cnj";
  searchKey: string;
  filter?: LawsuitFilter;
  // Includes lawsuits where JUDIT inferred the link from the party's name.
  // Homonym risk: check `was_inferred` on each party.
  withInferredParties?: boolean;
  onDemand?: boolean;
  // Acceptable staleness in days. Only has effect with onDemand.
  cacheTtlInDays?: number;
}) {
  const searchKey = params.searchKey.trim();
  await assertAllowedSearchKey(params.searchType, searchKey);

  return juditRequest({
    service: "lawsuits",
    method: "POST",
    path: "/lawsuits",
    body: {
      search: {
        search_type: params.searchType,
        search_key: searchKey,
        ...(params.onDemand ? { on_demand: true } : {}),
        ...(params.onDemand && params.cacheTtlInDays !== undefined
          ? { cache_ttl_in_days: params.cacheTtlInDays }
          : {}),
        ...searchParams(params.filter, params.withInferredParties),
      },
    },
    schema: lawsuitsSearchResponseSchema,
    // Docs: "404 — Nenhum processo encontrado. A resposta vem com
    // has_lawsuits: false mesmo assim". Not finding lawsuits is a result,
    // not a failure, but only when the body says so explicitly.
    acceptErrorBody: (status, body) =>
      status === 404 &&
      typeof body === "object" &&
      body !== null &&
      "has_lawsuits" in body &&
      body.has_lawsuits === false,
    timeoutMs: params.onDemand ? ON_DEMAND_TIMEOUT_MS : undefined,
  });
}

// POST /lawsuits/count: only the total, no list.
// https://docs.judit.io/cache-judit/count
export async function countLawsuits(params: {
  searchType: DocumentSearchType | "lawsuit_cnj" | "rji";
  searchKey: string;
  filter?: LawsuitFilter;
}) {
  const searchKey = params.searchKey.trim();
  await assertAllowedSearchKey(params.searchType, searchKey);

  return juditRequest({
    service: "lawsuits",
    method: "POST",
    path: "/lawsuits/count",
    body: {
      search: {
        search_type: params.searchType,
        search_key: searchKey,
        // The page marks it required with value "lawsuits"; the page's own
        // examples omit it (see README).
        response_type: "lawsuits",
        ...searchParams(params.filter),
      },
    },
    schema: lawsuitsCountResponseSchema,
  });
}

// POST /lawsuits/synthetic: counts grouped by tribunal, phase, area, etc.
// https://docs.judit.io/cache-judit/cache-grouped
export async function getLawsuitsSynthetic(params: {
  searchType: DocumentSearchType;
  searchKey: string;
  filter?: LawsuitFilter;
}) {
  const searchKey = params.searchKey.trim();
  await assertAllowedSearchKey(params.searchType, searchKey);

  return juditRequest({
    service: "lawsuits",
    method: "POST",
    path: "/lawsuits/synthetic",
    body: {
      search: {
        search_type: params.searchType,
        search_key: searchKey,
        ...searchParams(params.filter),
      },
    },
    schema: lawsuitsSyntheticResponseSchema,
  });
}

// GET /lawsuits/{lawsuit_cnj}: one lawsuit from the datalake. There is no
// docs page for it, only the OpenAPI spec. A 404 means the CNJ is not in the
// datalake (https://docs.judit.io/resource/errors); unlike POST /lawsuits,
// no "not found" body is documented, so 404 stays an error.
// The spec's attachment query params (all_att, saved_att,
// only_att_with_steps) are not exposed: attachments are out of scope.
export async function getLawsuitByCnj(params: {
  cnj: string;
  instance?: number;
}) {
  const cnj = params.cnj.trim();
  await assertAllowedSearchKey("lawsuit_cnj", cnj);

  return juditRequest({
    service: "lawsuits",
    method: "GET",
    path: `/lawsuits/${encodeURIComponent(cnj)}`,
    query: { instance: params.instance },
    schema: lawsuitByCnjResponseSchema,
  });
}

function searchParams(filter?: LawsuitFilter, withInferredParties?: boolean) {
  const search_params = {
    ...(filter ? { filter } : {}),
    ...(withInferredParties ? { with_inferred_parties: true } : {}),
  };
  return Object.keys(search_params).length > 0 ? { search_params } : {};
}
