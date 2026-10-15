"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import type { JuditRequest } from "@/db/models";
import { cnpjSchema } from "@/features/companies/cnpj";
import { getCompanyByCnpj } from "@/features/companies/db";
import { productCallbackUrl } from "@/features/webhooks/callback";
import { processEventsForReference } from "@/features/webhooks/process";
import { getDataSource } from "@/lib/data";
import { createRequest, getRequest, listResponses } from "@/lib/judit/requests";

import {
  findOpenJuditRequest,
  getJuditRequest,
  saveJuditRequest,
  updateJuditRequestStatus,
} from "./db";
import { juditActionFailure, type JuditActionFailure } from "./failure";
import { summarizeResponses, type ResponsesSummary } from "./responses";

// Server Actions da consulta assíncrona (POST /requests). O fluxo tem dois
// passos, cada um disparado por um clique, sem polling automático:
//
//   1. startAsyncQueryAction  cria a consulta na JUDIT e grava o request_id
//   2. checkAsyncQueryAction  pergunta o status (GET /requests/{id}) e,
//                             quando "completed", lê as respostas
//                             (GET /responses?request_id=...)
//
// Com JUDIT_WEBHOOK_PUBLIC_ORIGIN preenchida, o passo 1 também envia a
// callback_url: a JUDIT avisa o fim da consulta pelo webhook (código 600), e
// o processamento (src/features/webhooks/process.ts) grava "completed" sem
// ninguém perguntar. O passo 2 continua disponível: se o túnel cair, a
// entrega se perde, mas o resultado não.
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

    // Uma consulta igual ainda em aberto: a segunda seria cobrada e traria
    // o mesmo resultado. Regra simples, por consulta prévia: dois envios no
    // mesmo instante (dois cliques, duas abas) ainda passam juntos. O
    // monitoramento, cobrado a cada recorrência, tem a regra no índice único.
    const open = await findOpenJuditRequest(company.id, query.mode);
    if (open) {
      return {
        ok: false,
        reason: "invalid",
        message:
          'Já existe uma consulta igual em andamento para esta empresa. Use "Verificar status" nela antes de criar outra.',
      };
    }

    // Antes da chamada cobrada: uma configuração de webhook pela metade
    // (origem sem token) falha aqui, sem gastar crédito.
    const callbackUrl = productCallbackUrl();

    // A modalidade decide os parâmetros: on_demand só na on-demand, e
    // cache_ttl_in_days só junto com ele (a página on-demand diz que ele só
    // tem efeito com on_demand: true).
    const created = await createRequest({
      searchType: "cnpj",
      searchKey: company.cnpj,
      onDemand: query.mode === "historical_on_demand",
      cacheTtlInDays: cacheTtlInDays ?? undefined,
      callbackUrl: callbackUrl ?? undefined,
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
      delivery: callbackUrl ? "webhook" : "polling",
      searchType: "cnpj",
      searchKey: company.cnpj,
      cacheTtlInDays,
      status: created.status,
    });
    if (callbackUrl) await processEarlyDeliveries(created.request_id);
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

    // "completed" é final: não há o que perguntar de novo à JUDIT. O banco
    // chega a esse status por esta mesma action ou pelo webhook (código 600).
    let request = stored;
    if (stored.status !== "completed") {
      const remote = await getRequest(stored.requestId);
      request =
        (await updateJuditRequestStatus(stored.requestId, remote.status)) ??
        stored;

      // Antes de "completed", as respostas podem estar incompletas: a
      // documentação diz que só esse status indica o conjunto final.
      if (remote.status !== "completed") {
        refresh();
        return { ok: true, request, results: null };
      }
    }

    const list = await listResponses({ requestId: stored.requestId });
    const results = summarizeResponses(list, company);

    refresh();
    return { ok: true, request, results };
  } catch (error) {
    return juditActionFailure(error, "queries");
  }
}

// A consulta já foi criada e gravada; uma falha aqui não muda isso. Os
// eventos continuam em /webhooks, para "Reprocessar".
async function processEarlyDeliveries(requestId: string) {
  try {
    const results = await processEventsForReference(requestId);
    if (results.length > 0) {
      console.info(
        `[queries] ${results.length} entrega(s) recebida(s) antes da gravação processada(s): request_id ${requestId}`,
      );
    }
  } catch (error) {
    console.error(
      `[queries] falha ao processar entregas antecipadas (request_id ${requestId}):`,
      error instanceof Error ? error.message : String(error),
    );
  }
}

function unavailable(): Unavailable {
  return {
    ok: false,
    reason: "unavailable",
    message: "Consultas à JUDIT só funcionam no modo banco de dados.",
  };
}
