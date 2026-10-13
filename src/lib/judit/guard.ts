import "server-only";

import { normalizeCnpj } from "@/features/companies/cnpj";
import { normalizeCnj } from "@/features/processes/cnj";
import { getServerEnv } from "@/lib/env";

import { JuditGuardError, JuditLiveCallsDisabledError } from "./errors";

// Cost and safety guard. The JUDIT key has limited credits, so every call goes
// through two server-side checks before reaching the network:
//
// 1. Kill switch: JUDIT_LIVE_CALLS must be exactly "enabled".
// 2. Allowlist: searches by document, name or CNJ only run for keys listed
//    below.
//
// This only protects calls made by this app. The same key used in Postman,
// curl or another app bypasses all of it.

export function assertLiveCallsEnabled(): void {
  if (getServerEnv("JUDIT_LIVE_CALLS") !== "enabled") {
    throw new JuditLiveCallsDisabledError();
  }
}

// Search types that identify a person, company or lawsuit, as listed in the
// docs (`search_type`: cpf, cnpj, oab, name, rji, lawsuit_cnj).
export type GuardedSearchType =
  "cpf" | "cnpj" | "oab" | "name" | "rji" | "lawsuit_cnj";

// Entries may be written formatted or not: both sides are normalized before
// comparing. Add new keys here deliberately, one at a time.
const ALLOWLIST: Record<GuardedSearchType, readonly string[]> = {
  // Fictitious test company used throughout the docs. Only "-68" has valid
  // check digits; the count page's "-90" variant does not (see README).
  cnpj: ["A1B2C3D4E5F668"],
  cpf: [],
  oab: [],
  name: [],
  rji: [],
  lawsuit_cnj: [],
};

// CNPJ and CNJ reuse the app's existing normalizers. The OAB, RJI and name
// formats are not specified in the docs, so these are conservative choices of
// ours: uppercase, keeping only letters and digits (or collapsed spaces for
// names).
const NORMALIZERS: Record<GuardedSearchType, (value: string) => string> = {
  cnpj: normalizeCnpj,
  lawsuit_cnj: normalizeCnj,
  cpf: (value) => value.replace(/\D/g, ""),
  oab: (value) => value.toUpperCase().replace(/[^0-9A-Z]/g, ""),
  rji: (value) => value.toUpperCase().replace(/[^0-9A-Z]/g, ""),
  name: (value) => value.trim().replace(/\s+/g, " ").toUpperCase(),
};

// Only checks. Which format is sent to JUDIT (formatted or digits only) is
// decided by each service function, based on its docs page.
export function assertAllowedSearchKey(
  searchType: GuardedSearchType,
  searchKey: string,
): void {
  const normalize = NORMALIZERS[searchType];
  const normalized = normalize(searchKey);

  if (normalized === "") {
    throw new JuditGuardError(`Chave de busca vazia para ${searchType}.`);
  }

  const allowed = ALLOWLIST[searchType].some(
    (entry) => normalize(entry) === normalized,
  );

  if (!allowed) {
    // The rejected key is not echoed back: it may be a real person's
    // document.
    throw new JuditGuardError(
      `Chave de busca (${searchType}) fora da allowlist em src/lib/judit/guard.ts.`,
    );
  }
}
