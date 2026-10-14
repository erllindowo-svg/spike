"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import type { JuditRequest } from "@/db/models";
import { cnpjSchema } from "@/features/companies/cnpj";
import { getCompanyByCnpj } from "@/features/companies/db";
import { getDataSource } from "@/lib/data";
import { createRequest, getRequest, listResponses } from "@/lib/judit/requests";

import {
  getJuditRequest,
  saveJuditRequest,
  updateJuditRequestStatus,
} from "./db";
import { juditActionFailure, type JuditActionFailure } from "./failure";
import { summarizeResponses, type ResponsesSummary } from "./responses";

// Server Actions da consulta assíncrona (POST /requests). O fluxo tem três
// passos, cada um disparado por um clique, sem polling automático:
//
//   1. startAsyncQueryAction  cria a consulta na JUDIT e grava o request_id
//   2. checkAsyncQueryAction  pergunta o status (GET /requests/{id}) e,
//                             quando "completed", lê as respostas
//                             (GET /responses?request_id=...)
//
// Como em searchCompanyLawsuitsAction, nada aqui confia no navegador: modo
// "db", empresa cadastrada, kill switch e allowlist do client.

type Unavailable = {
  ok: false;
  reason: "unavailable" | "invalid";
  message: string;
};

const startInputSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("historical_async"), cnpj: cnpjSchema }),
  z.object({
    mode: z.literal("historical_on_demand"),
    cnpj: cnpjSchema,
    // A documentação define "integer (> 0)" e não informa limite superior.
    cacheTtlInDays: z.number().int().positive().optional(),
  }),
]);

export type StartAsyncQueryInput = z.input<typeof startInputSchema>;

export type StartAsyncQueryResult =
  { ok: true; request: JuditRequest } | Unavailable | JuditActionFailure;

export async function startAsyncQueryAction(
  input: StartAsyncQueryInput,
): Promise<StartAsyncQueryResult> {
  if (getDataSource() !== "db") return unavailable();

  const parsed = startInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, reason: "invalid", message: "Dados inválidos." };
  }
  const query = parsed.data;
  const cacheTtlInDays =
    query.mode === "historical_on_demand"
      ? (query.cacheTtlInDays ?? null)
      : null;

  try {
    const company = await getCompanyByCnpj(query.cnpj);
    if (!company) {
      return {
        ok: false,
        reason: "invalid",
        message: "Empresa não cadastrada na aplicação.",
      };
    }

    // A modalidade decide os parâmetros: on_demand só na on-demand, e
    // cache_ttl_in_days só junto com ele (a página on-demand diz que ele só
    // tem efeito com on_demand: true).
    const created = await createRequest({
      searchType: "cnpj",
      searchKey: company.cnpj,
      onDemand: query.mode === "historical_on_demand",
      cacheTtlInDays: cacheTtlInDays ?? undefined,
    });

    // A JUDIT já aceitou (e cobrou) a consulta. Se a gravação falhar agora,
    // o request_id se perderia; por isso ele vai para o log antes. Não é um
    // dado sensível: sozinho, não dá acesso a nada sem a chave da API.
    console.info(
      `[queries] consulta ${query.mode} criada na JUDIT: request_id ${created.request_id}`,
    );

    const request = await saveJuditRequest({
      requestId: created.request_id,
      companyId: company.id,
      mode: query.mode,
      delivery: "polling",
      searchType: "cnpj",
      searchKey: company.cnpj,
      cacheTtlInDays,
      status: created.status,
    });
    refresh();
    return { ok: true, request };
  } catch (error) {
    return juditActionFailure(error, "queries");
  }
}

export type CheckAsyncQueryResult =
  | {
      ok: true;
      request: JuditRequest;
      // Só existe quando o status é "completed".
      results: ResponsesSummary | null;
    }
  | Unavailable
  | JuditActionFailure;

export async function checkAsyncQueryAction(
  requestId: string,
): Promise<CheckAsyncQueryResult> {
  if (getDataSource() !== "db") return unavailable();

  const parsedId = z.string().min(1).max(100).safeParse(requestId);
  if (!parsedId.success) {
    return { ok: false, reason: "invalid", message: "request_id inválido." };
  }

  try {
    // Só acompanhamos consultas criadas por esta aplicação. A allowlist do
    // client não cobre chamadas por ID (README da integração), então esta
    // consulta ao banco é a barreira que impede ler consultas de terceiros.
    const stored = await getJuditRequest(parsedId.data);
    if (!stored) {
      return {
        ok: false,
        reason: "invalid",
        message: "Consulta não encontrada nesta aplicação.",
      };
    }
    const company = await getCompanyByCnpj(stored.searchKey);
    if (!company) {
      return {
        ok: false,
        reason: "invalid",
        message: "Empresa não cadastrada na aplicação.",
      };
    }

    const remote = await getRequest(stored.requestId);
    const request =
      (await updateJuditRequestStatus(stored.requestId, remote.status)) ??
      stored;

    // Antes de "completed", as respostas podem estar incompletas: a
    // documentação diz que só esse status indica o conjunto final.
    if (remote.status !== "completed") {
      refresh();
      return { ok: true, request, results: null };
    }

    const list = await listResponses({ requestId: stored.requestId });
    const results = summarizeResponses(list, company);

    refresh();
    return { ok: true, request, results };
  } catch (error) {
    return juditActionFailure(error, "queries");
  }
}

function unavailable(): Unavailable {
  return {
    ok: false,
    reason: "unavailable",
    message: "Consultas à JUDIT só funcionam no modo banco de dados.",
  };
}
