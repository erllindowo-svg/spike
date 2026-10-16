"use server";

import { cnpjSchema } from "@/features/companies/cnpj";
import { getCompanyByCnpj } from "@/features/companies/db";
import { juditActionFailure } from "@/features/queries/failure";
import { logSyncQuery, syncFailureFor } from "@/features/queries/sync-log";
import { getDataSource } from "@/lib/data";
import { searchLawsuits } from "@/lib/judit/lawsuits";

import { fromJuditLawsuit } from "./judit";
import type { Lawsuit } from "./types";

// Server Action: consulta, sob clique, os processos de uma empresa no datalake
// da JUDIT (POST /lawsuits, síncrono). O resultado vai direto para a tela e
// não é gravado no MongoDB: a fonte dos processos continua sendo a JUDIT.
//
// Cada chamada é cobrada. Como qualquer pessoa pode enviar um POST direto
// para esta action, ela não confia no navegador: exige o modo "db", uma
// empresa já cadastrada e passa pelo kill switch e pela allowlist do
// client (src/lib/judit/guard.ts). Isso limita O QUE pode ser consultado,
// não QUEM nem QUANTAS vezes: sem autenticação nem limite de taxa, a
// aplicação não deve ficar pública com JUDIT_LIVE_CALLS ligado.

export type SearchCompanyLawsuitsResult =
  | {
      ok: true;
      lawsuits: Lawsuit[];
      // Identificador da consulta na JUDIT, útil para levar ao suporte.
      requestId: string | null;
      fetchedAt: Date;
    }
  | {
      ok: false;
      reason:
        | "unavailable"
        | "invalid"
        | "live_calls_disabled"
        | "not_allowed"
        | "timeout"
        | "error";
      message: string;
    };

export async function searchCompanyLawsuitsAction(
  cnpj: string,
): Promise<SearchCompanyLawsuitsResult> {
  if (getDataSource() !== "db") {
    return {
      ok: false,
      reason: "unavailable",
      message: "Consultas à JUDIT só funcionam no modo banco de dados.",
    };
  }

  const parsed = cnpjSchema.safeParse(cnpj);
  if (!parsed.success) {
    return { ok: false, reason: "invalid", message: "CNPJ inválido." };
  }

  try {
    const company = await getCompanyByCnpj(parsed.data);
    if (!company) {
      return {
        ok: false,
        reason: "invalid",
        message: "Empresa não cadastrada na aplicação.",
      };
    }

    // CNPJ sem máscara (14 caracteres), como a JUDIT devolve em
    // `main_document` e como a página do Hot Storage sugere ("14 para CNPJ").
    let result;
    try {
      result = await searchLawsuits({
        searchType: "cnpj",
        searchKey: company.cnpj,
      });
    } catch (error) {
      await logFailure(error, company);
      throw error;
    }

    // Histórico da página Consultas: só metadados, nunca os processos.
    await logSyncQuery({
      mode: "datalake_sync",
      companyId: company.id,
      searchType: "cnpj",
      searchKey: company.cnpj,
      requestId: result.request_id ?? null,
      outcome: "ok",
      resultCount: result.lawsuits.length,
      errorKind: null,
    });

    return {
      ok: true,
      lawsuits: result.lawsuits.map((item) => fromJuditLawsuit(item, company)),
      requestId: result.request_id ?? null,
      fetchedAt: new Date(),
    };
  } catch (error) {
    return juditActionFailure(error, "processes");
  }
}

async function logFailure(
  error: unknown,
  company: { id: string; cnpj: string },
) {
  const failure = syncFailureFor(error);
  if (!failure) return;
  await logSyncQuery({
    mode: "datalake_sync",
    companyId: company.id,
    searchType: "cnpj",
    searchKey: company.cnpj,
    requestId: null,
    resultCount: null,
    ...failure,
  });
}
