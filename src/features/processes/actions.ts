"use server";

import { cnpjSchema } from "@/features/companies/cnpj";
import { getCompanyByCnpj } from "@/features/companies/db";
import { getDataSource } from "@/lib/data";
import {
  JuditError,
  JuditGuardError,
  JuditLiveCallsDisabledError,
  JuditTimeoutError,
} from "@/lib/judit/errors";
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
    const result = await searchLawsuits({
      searchType: "cnpj",
      searchKey: company.cnpj,
    });

    return {
      ok: true,
      lawsuits: result.lawsuits.map((item) => fromJuditLawsuit(item, company)),
      requestId: result.request_id ?? null,
      fetchedAt: new Date(),
    };
  } catch (error) {
    return failure(error);
  }
}

function failure(error: unknown): SearchCompanyLawsuitsResult {
  if (error instanceof JuditLiveCallsDisabledError) {
    return {
      ok: false,
      reason: "live_calls_disabled",
      message: 'Chamadas reais desligadas. Defina JUDIT_LIVE_CALLS="enabled".',
    };
  }
  if (error instanceof JuditGuardError) {
    return {
      ok: false,
      reason: "not_allowed",
      message:
        "Este CNPJ não está na allowlist de desenvolvimento (src/lib/judit/guard.ts).",
    };
  }
  if (error instanceof JuditTimeoutError) {
    return {
      ok: false,
      reason: "timeout",
      message:
        "A JUDIT não respondeu a tempo. A consulta pode ter sido cobrada mesmo assim; espere antes de repetir.",
    };
  }

  // As mensagens das classes JuditError não carregam a chave nem o payload
  // (regra de errors.ts), então podem ir para o log do servidor. Erros de
  // outra origem (ex.: driver do MongoDB) registram só a mensagem.
  console.error(
    "[processes] falha ao consultar a JUDIT:",
    error instanceof JuditError
      ? `${error.name} (${error.kind}): ${error.message}`
      : error instanceof Error
        ? error.message
        : error,
  );
  return {
    ok: false,
    reason: "error",
    message:
      error instanceof JuditError
        ? `A JUDIT retornou um erro (${error.kind}). Detalhes no log do servidor.`
        : "Erro inesperado no servidor. Detalhes no log.",
  };
}
