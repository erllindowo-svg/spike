"use server";

import { getPartyByDocument } from "@/features/parties/db";
import { partyRefSchema, type PartyRef } from "@/features/parties/documents";
import { assertDailyBudget } from "@/features/queries/budget";
import {
  juditActionFailure,
  type JuditActionFailure,
} from "@/features/queries/failure";
import { logSyncQuery, syncFailureFor } from "@/features/queries/sync-log";
import { getDataSource } from "@/lib/data";
import { searchLawsuits } from "@/lib/judit/lawsuits";
import { saveBatch, saveQuietly } from "@/features/base/db";
import { lawsuitRecord } from "@/features/base/records";

import type { Party } from "@/db/models";

import { fromJuditLawsuit } from "./judit";
import type { Lawsuit } from "./types";

// Server Action: consulta, sob clique, os processos de uma parte (empresa ou
// pessoa física) no datalake
// da JUDIT (POST /lawsuits, síncrono). O resultado vai direto para a tela e
// não é gravado no MongoDB: a fonte dos processos continua sendo a JUDIT.
//
// Cada chamada é cobrada. Como qualquer pessoa pode enviar um POST direto
// para esta action, ela não confia no navegador: exige o modo "db", uma
// parte já cadastrada e passa pelas proteções de custo (teto diário aqui;
// kill switch, allowlist no modo restrito, limite por minuto e chamada única
// no client). Elas limitam O QUE e QUANTO, não QUEM: sem autenticação, a
// aplicação não deve ficar pública com JUDIT_LIVE_CALLS ligado.
//
// Volume (escolha S4): esta consulta não tem paginação na JUDIT e devolve
// todos os processos de uma vez. Para não travar o navegador com uma parte
// grande (um banco, por exemplo), a tela recebe no máximo MAX_LAWSUITS_ON_SCREEN e o total.

const MAX_LAWSUITS_ON_SCREEN = 500;

export type SearchPartyLawsuitsResult =
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

export async function searchPartyLawsuitsAction(
  ref: PartyRef,
): Promise<SearchPartyLawsuitsResult> {
  if (getDataSource() !== "db") {
    return {
      ok: false,
      reason: "unavailable",
      message: "Consultas à JUDIT só funcionam no modo banco de dados.",
    };
  }

  const parsed = partyRefSchema.safeParse(ref);
  if (!parsed.success) {
    return {
      ok: false,
      reason: "invalid",
      message: parsed.error.issues[0]?.message ?? "Documento inválido.",
    };
  }

  try {
    const party = await getPartyByDocument(
      parsed.data.documentType,
      parsed.data.document,
    );
    if (!party) {
      return {
        ok: false,
        reason: "invalid",
        message: "Parte não cadastrada na aplicação.",
      };
    }

    await assertDailyBudget();

    // Documento sem máscara (14 caracteres no CNPJ, 11 no CPF), como a
    // JUDIT devolve em `main_document` e como a página do Hot Storage sugere.
    let result;
    try {
      result = await searchLawsuits({
        searchType: party.documentType,
        searchKey: party.document,
      });
    } catch (error) {
      await logFailure(error, party);
      throw error;
    }

    // Histórico da página Consultas: só metadados, nunca os processos.
    await logSyncQuery({
      mode: "datalake_sync",
      partyId: party.id,
      searchType: party.documentType,
      searchKey: party.document,
      requestId: result.request_id ?? null,
      outcome: "ok",
      resultCount: result.lawsuits.length,
      errorKind: null,
    });

    // Base própria (D1): todos os processos, no nosso formato.
    const subject = {
      searchType: party.documentType,
      searchKey: party.document,
    };
    await saveQuietly(
      `datalake_sync, request_id ${result.request_id ?? "-"}`,
      () =>
        saveBatch(
          subject,
          {
            origin: "sync",
            mode: "datalake_sync",
            reference: result.request_id ?? null,
          },
          {
            records: result.lawsuits.map((item) =>
              lawsuitRecord(item, "lawsuit", subject),
            ),
            aiSummary: null,
          },
        ),
    );

    return {
      ok: true,
      lawsuits: result.lawsuits
        .slice(0, MAX_LAWSUITS_ON_SCREEN)
        .map((item) => fromJuditLawsuit(item, party)),
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
  party: Pick<Party, "id" | "documentType" | "document">,
) {
  const failure = syncFailureFor(error);
  if (!failure) return;
  await logSyncQuery({
    mode: "datalake_sync",
    partyId: party.id,
    searchType: party.documentType,
    searchKey: party.document,
    requestId: null,
    resultCount: null,
    ...failure,
  });
}
