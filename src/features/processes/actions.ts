"use server";

import { cnpjSchema } from "@/features/companies/cnpj";
import { getCompanyByCnpj } from "@/features/companies/db";
import { assertDailyBudget } from "@/features/queries/budget";
import {
  juditActionFailure,
  type JuditActionFailure,
} from "@/features/queries/failure";
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
// empresa já cadastrada e passa pelas proteções de custo (teto diário aqui;
// kill switch, allowlist no modo restrito, limite por minuto e chamada única
// no client). Elas limitam O QUE e QUANTO, não QUEM: sem autenticação, a
// aplicação não deve ficar pública com JUDIT_LIVE_CALLS ligado.
//
// Volume (escolha S4): esta consulta não tem paginação na JUDIT e devolve
// todos os processos de uma vez. Para não travar o navegador com uma empresa
// grande, a tela recebe no máximo MAX_LAWSUITS_ON_SCREEN e o total.

const MAX_LAWSUITS_ON_SCREEN = 500;

export type SearchCompanyLawsuitsResult =
  | {
      ok: true;
      // No máximo MAX_LAWSUITS_ON_SCREEN; `total` diz quantos vieram.
      lawsuits: Lawsuit[];
      total: number;
      // Identificador da consulta na JUDIT, útil para levar ao suporte.
      requestId: string | null;
      fetchedAt: Date;
    }
  | { ok: false; reason: "unavailable" | "invalid"; message: string }
  | JuditActionFailure;

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

    await assertDailyBudget();

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
      lawsuits: result.lawsuits
        .slice(0, MAX_LAWSUITS_ON_SCREEN)
        .map((item) => fromJuditLawsuit(item, company)),
      total: result.lawsuits.length,
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
