import { after } from "next/server";

import {
  fullPayloadEnabled,
  getWebhookToken,
  isValidWebhookToken,
  redactToken,
  WEBHOOK_TOKEN_PARAM,
} from "@/features/webhooks/callback";
import { saveQuietly } from "@/features/base/db";
import { saveDeliveryToBase } from "@/features/base/ingest";
import { saveWebhookEvent } from "@/features/webhooks/db";
import { prepareWebhookEvent } from "@/features/webhooks/envelope";
import { processWebhookEvent } from "@/features/webhooks/process";
import { getServerEnv } from "@/lib/env";

// Recebe as entregas da JUDIT (https://docs.judit.io/webhook/callbacks).
//
// Contrato documentado: POST com JSON numa URL HTTPS pública; a JUDIT espera
// 2xx em menos de 10 s e, em 5xx ou timeout, tenta de novo com backoff. Uma
// resposta 4xx não é repetida. Por isso o status escolhido em cada caso é uma
// decisão sobre "a JUDIT deve tentar de novo?":
//
//   404  webhook desligado (sem token ou fora do modo "db")   não repete
//   401  token ausente ou errado (não veio da JUDIT)          não repete
//   400  corpo não é JSON ou o envelope tem tipo errado       não repete
//   200  evento gravado, ou reentrega já gravada antes        entregue
//   503  configuração inválida ou banco indisponível          repete
//
// O evento é gravado ANTES do 200: se o banco falhar, a JUDIT tenta de novo e
// nada se perde. Processar o evento (associar, gerar alerta) acontece DEPOIS
// da resposta, com after(): a JUDIT recebe o 200 sem esperar as regras, e uma
// falha no processamento não vira 5xx (o evento já está gravado e fica
// "failed", para "Reprocessar" em /webhooks). O log mostra só
// identificadores, nunca o token nem dados do processo.

export async function POST(request: Request) {
  let token: string | undefined;
  try {
    if (getServerEnv("DATA_SOURCE") !== "db") return reply(404);
    token = getWebhookToken();
  } catch {
    // Variável com valor inválido (ex.: token com menos de 32 caracteres).
    // A mensagem do erro não é repetida: só o nome da variável importa.
    console.error("[webhooks] configuração inválida: confira o .env.local");
    return reply(503);
  }
  if (!token) return reply(404);

  const received = new URL(request.url).searchParams.get(WEBHOOK_TOKEN_PARAM);
  if (!isValidWebhookToken(received, token)) {
    console.warn("[webhooks] token ausente ou inválido: entrega recusada");
    return reply(401);
  }

  let body: unknown;
  try {
    body = JSON.parse(await request.text());
  } catch {
    console.warn("[webhooks] corpo não é JSON: entrega recusada");
    return reply(400);
  }

  const fullPayload = fullPayloadEnabled();
  const prepared = prepareWebhookEvent(body, { token, fullPayload });
  if (!prepared.ok) {
    console.warn(`[webhooks] envelope inválido: ${prepared.issues.join("; ")}`);
    return reply(400);
  }

  const { event } = prepared;
  const ids =
    `callback_id=${event.callbackId ?? "(ausente)"} ` +
    `${event.referenceType ?? "?"}=${event.referenceId ?? "?"} ` +
    `response_type=${prepared.responseType ?? "?"}`;

  try {
    const saved = await saveWebhookEvent(event);
    if (saved.duplicate) {
      console.info(`[webhooks] reentrega já gravada: ${ids}`);
      return reply(200, { duplicate: true });
    }
    console.info(
      `[webhooks] recebido: ${ids}${fullPayload ? " (payload completo)" : ""}`,
    );
    const eventId = saved.event.id;
    after(async () => {
      await processWebhookEvent(eventId).catch((error: unknown) => {
        // Só falhas de banco ao reivindicar ou ao registrar o resultado
        // chegam aqui; o evento continua gravado.
        const message = error instanceof Error ? error.message : String(error);
        console.error(
          `[webhooks] processamento interrompido (${ids}):`,
          redactToken(message, token),
        );
      });
      // Base própria (D1): o processo inteiro só existe nesta requisição (o
      // evento gravado guarda um resumo). Uma entrega que chega antes de a
      // consulta ser gravada não acha o assunto e não grava; o resultado
      // volta à base quando a consulta é aberta ("Ver resultado").
      await saveQuietly(ids, () => saveDeliveryToBase(body as never));
    });
    return reply(200, { duplicate: false });
  } catch (error) {
    // A mensagem do driver pode conter qualquer coisa; o token sai dela.
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `[webhooks] falha ao gravar (${ids}):`,
      redactToken(message, token),
    );
    return reply(503);
  }
}

const statusText: Record<number, string> = {
  200: "received",
  400: "invalid_body",
  401: "unauthorized",
  404: "not_found",
  503: "unavailable",
};

function reply(status: number, extra: Record<string, unknown> = {}) {
  return Response.json({ status: statusText[status], ...extra }, { status });
}
