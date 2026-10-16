"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import type { JuditRequest, QuerySearchType } from "@/db/models";
import { getPartyByDocument } from "@/features/parties/db";
import { partyRefSchema } from "@/features/parties/documents";
import { cnjSchema, formatCnj } from "@/features/processes/cnj";
import { productCallbackUrl } from "@/features/webhooks/callback";
import { processEventsForReference } from "@/features/webhooks/process";
import { getDataSource } from "@/lib/data";

import { assertDailyBudget } from "./budget";
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
// "db", parte cadastrada, teto diário e as proteções do client.

type Unavailable = {
  ok: false;
  reason: "unavailable" | "invalid";
  message: string;
};

// Consultas por documento (a parte precisa estar salva):
//   historical_async / historical_on_demand   capa e partes de todos os
//     processos (https://docs.judit.io/requests/request-document)
//   criminal_execution   execução penal (response_type "execution")
//   warrant              mandados de prisão, só por CPF (response_type
//                        "warrant"; a JUDIT aceita CPF, nome e RJI)
// Consulta por processo, sem parte:
//   lawsuit_async   o processo inteiro pelo CNJ, com resumo por IA opcional
const documentModesSchema = z.intersection(
  partyRefSchema,
  z.discriminatedUnion("mode", [
    z.object({ mode: z.literal("historical_async") }),
    z.object({
      mode: z.literal("historical_on_demand"),
      // A documentação define "integer (> 0)" e não informa limite superior.
      cacheTtlInDays: z.number().int().positive().optional(),
    }),
    z.object({ mode: z.literal("criminal_execution") }),
    z.object({ mode: z.literal("warrant") }),
  ]),
);

const lawsuitModeSchema = z.object({
  mode: z.literal("lawsuit_async"),
  cnj: cnjSchema,
  aiSummary: z.boolean().optional(),
});

const startInputSchema = z
  .union([lawsuitModeSchema, documentModesSchema])
  .refine((query) => query.mode !== "warrant" || query.documentType === "cpf", {
    message: "Mandados de prisão só são consultados por CPF.",
  });

export type StartAsyncQueryInput = z.input<typeof startInputSchema>;

export type StartAsyncQueryResult =
  { ok: true; request: JuditRequest } | Unavailable | JuditActionFailure;

export async function startAsyncQueryAction(
  input: StartAsyncQueryInput,
): Promise<StartAsyncQueryResult> {
  if (getDataSource() !== "db") return unavailable();

  const parsed = startInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      reason: "invalid",
      message: parsed.error.issues[0]?.message ?? "Dados inválidos.",
    };
  }
  const query = parsed.data;
  const cacheTtlInDays =
    query.mode === "historical_on_demand"
      ? (query.cacheTtlInDays ?? null)
      : null;

  try {
    // O alvo: a parte salva (consultas por documento) ou o CNJ.
    let target: {
      partyId: string | null;
      searchType: QuerySearchType;
      searchKey: string;
    };
    if (query.mode === "lawsuit_async") {
      target = { partyId: null, searchType: "cnj", searchKey: query.cnj };
    } else {
      const party = await getPartyByDocument(
        query.documentType,
        query.document,
      );
      if (!party) {
        return {
          ok: false,
          reason: "invalid",
          message: "Parte não cadastrada na aplicação.",
        };
      }
      target = {
        partyId: party.id,
        searchType: party.documentType,
        searchKey: party.document,
      };
    }

    // Uma consulta igual ainda em aberto: a segunda seria cobrada e traria
    // o mesmo resultado. Regra simples, por consulta prévia: dois envios no
    // mesmo instante (dois cliques, duas abas) ainda passam juntos (o client
    // barra a chamada idêntica em andamento). O monitoramento, cobrado a
    // cada recorrência, tem a regra no índice único.
    const open = await findOpenJuditRequest(target, query.mode);
    if (open) {
      return {
        ok: false,
        reason: "invalid",
        message:
          'Já existe uma consulta igual em andamento. Use "Verificar status" nela antes de criar outra.',
      };
    }

    // Antes da chamada cobrada: uma configuração de webhook pela metade
    // (origem sem token) falha aqui, sem gastar crédito; o teto diário
    // também.
    const callbackUrl = productCallbackUrl();
    await assertDailyBudget();

    // A modalidade decide os parâmetros: on_demand só na on-demand, e
    // cache_ttl_in_days só junto com ele (a página on-demand diz que ele só
    // tem efeito com on_demand: true); response_type nas consultas
    // criminais; judit_ia só quando pedido.
    const created = await createRequest(
      query.mode === "lawsuit_async"
        ? {
            searchType: "lawsuit_cnj",
            // Formatado, como nos exemplos da documentação.
            searchKey: formatCnj(query.cnj),
            juditIa: query.aiSummary ? ["summary"] : undefined,
            callbackUrl: callbackUrl ?? undefined,
          }
        : {
            searchType: query.documentType,
            searchKey: target.searchKey,
            responseType:
              query.mode === "warrant"
                ? "warrant"
                : query.mode === "criminal_execution"
                  ? "execution"
                  : undefined,
            onDemand: query.mode === "historical_on_demand",
            cacheTtlInDays: cacheTtlInDays ?? undefined,
            callbackUrl: callbackUrl ?? undefined,
          },
    );

    // A JUDIT já aceitou (e cobrou) a consulta. Se a gravação falhar agora,
    // o request_id se perderia; por isso ele vai para o log antes. Não é um
    // dado sensível: sozinho, não dá acesso a nada sem a chave da API.
    console.info(
      `[queries] consulta ${query.mode} criada na JUDIT: request_id ${created.request_id}`,
    );

    const request = await saveJuditRequest({
      requestId: created.request_id,
      partyId: target.partyId,
      mode: query.mode,
      delivery: callbackUrl ? "webhook" : "polling",
      searchType: target.searchType,
      searchKey: target.searchKey,
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
    // Consulta por processo: não há parte para descobrir o lado.
    const party =
      stored.searchType === "cnj"
        ? null
        : await getPartyByDocument(stored.searchType, stored.searchKey);
    if (stored.searchType !== "cnj" && !party) {
      return {
        ok: false,
        reason: "invalid",
        message: "Parte não cadastrada na aplicação.",
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
    const results = summarizeResponses(list, party);

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
