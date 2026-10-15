import "server-only";

import { randomUUID } from "node:crypto";

import { getDb } from "@/db";
import {
  collections,
  WEBHOOK_EVENTS_CALLBACK_ID_INDEX,
  type WebhookEventDoc,
} from "@/db/collections";
import { isDuplicateKeyError } from "@/db/errors";
import type { WebhookEvent } from "@/db/models";

import type { NewWebhookEvent } from "./envelope";

export type SavedWebhookEvent =
  { duplicate: false; event: WebhookEvent } | { duplicate: true; event: null };

// Campo a campo, como toTracking: eventos da etapa 5 não têm os campos da
// etapa 6, e null é o equivalente (nunca houve tentativa de processamento).
function toWebhookEvent(doc: WebhookEventDoc): WebhookEvent {
  return {
    id: doc._id,
    callbackId: doc.callbackId,
    eventType: doc.eventType,
    referenceType: doc.referenceType,
    referenceId: doc.referenceId,
    payload: doc.payload,
    receivedAt: doc.receivedAt,
    processingStatus: doc.processingStatus,
    processingStartedAt: doc.processingStartedAt ?? null,
    processedAt: doc.processedAt,
    processingNote: doc.processingNote ?? null,
    processingError: doc.processingError,
  };
}

// Grava uma entrega da JUDIT (coleção `webhook_events`) com status
// "pending": receber não é processar. O processamento (process.ts) vem
// depois da resposta HTTP.
//
// Reentrega: a JUDIT repete a entrega com o mesmo `callback_id` quando não
// recebe 2xx a tempo. O índice único recusa a segunda gravação, e isso volta
// como `duplicate: true`, sem erro: para a JUDIT, a entrega já foi recebida.
// A regra fica no índice, e não numa consulta antes do insert, porque duas
// entregas simultâneas passariam juntas pela consulta.
// Qualquer outro erro sobe para a rota, que responde 503 (a JUDIT tenta de
// novo).
export async function saveWebhookEvent(
  input: NewWebhookEvent,
): Promise<SavedWebhookEvent> {
  const { webhookEvents } = collections(await getDb());
  const doc: WebhookEventDoc = {
    _id: randomUUID(),
    ...input,
    receivedAt: new Date(),
    processingStatus: "pending",
    processingStartedAt: null,
    processedAt: null,
    processingNote: null,
    processingError: null,
  };

  try {
    await webhookEvents.insertOne(doc);
  } catch (error) {
    if (isDuplicateKeyError(error, WEBHOOK_EVENTS_CALLBACK_ID_INDEX)) {
      return { duplicate: true, event: null };
    }
    throw error;
  }
  return { duplicate: false, event: toWebhookEvent(doc) };
}

// As entregas mais recentes primeiro. Usado pela rota de dev
// (src/app/api/dev/webhooks/route.ts) e pela tela /webhooks.
export async function listRecentWebhookEvents(
  limit: number,
): Promise<WebhookEvent[]> {
  const { webhookEvents } = collections(await getDb());
  const docs = await webhookEvents
    .find()
    .sort({ receivedAt: -1 })
    .limit(limit)
    .toArray();
  return docs.map(toWebhookEvent);
}

// --- Processamento ----------------------------------------------------------

// Depois desse tempo, um evento em "processing" é considerado preso (o
// servidor caiu no meio) e pode ser processado de novo. Processar um evento
// leva milissegundos; 5 minutos é uma folga larga.
export const STALE_PROCESSING_MS = 5 * 60 * 1000;

// Marca o evento como "em processamento" numa única operação atômica, como
// claimReservation dos monitoramentos: se o processamento automático (logo
// depois do 200) e um "Reprocessar" coincidirem, só um encontra o evento
// disponível. O outro recebe null.
//
// Disponível: pendente, com falha, ignorado (a referência pode ter sido
// gravada depois do evento) ou preso em "processing". Um evento já
// "processed" não é processado de novo.
export async function claimWebhookEvent(
  id: string,
  now = new Date(),
): Promise<WebhookEvent | null> {
  const { webhookEvents } = collections(await getDb());
  const staleBefore = new Date(now.getTime() - STALE_PROCESSING_MS);
  const doc = await webhookEvents.findOneAndUpdate(
    {
      _id: id,
      $or: [
        { processingStatus: { $in: ["pending", "failed", "ignored"] } },
        {
          processingStatus: "processing",
          processingStartedAt: { $lt: staleBefore },
        },
      ],
    },
    {
      $set: {
        processingStatus: "processing",
        processingStartedAt: now,
        processedAt: null,
        processingNote: null,
        processingError: null,
      },
    },
    { returnDocument: "after" },
  );
  return doc ? toWebhookEvent(doc) : null;
}

export type ProcessingOutcome =
  | { status: "processed" | "ignored"; note: string }
  | { status: "failed"; error: string };

// Registra o resultado. Só sai de "processing": quem chama acabou de
// reivindicar o evento.
export async function finishWebhookEvent(
  id: string,
  outcome: ProcessingOutcome,
): Promise<WebhookEvent | null> {
  const { webhookEvents } = collections(await getDb());
  const doc = await webhookEvents.findOneAndUpdate(
    { _id: id, processingStatus: "processing" },
    {
      $set: {
        processingStatus: outcome.status,
        processedAt: new Date(),
        processingNote: outcome.status === "failed" ? null : outcome.note,
        processingError: outcome.status === "failed" ? outcome.error : null,
      },
    },
    { returnDocument: "after" },
  );
  return doc ? toWebhookEvent(doc) : null;
}

// Eventos de uma referência (request_id ou tracking_id) que ainda podem ser
// processados. Usado quando a consulta é gravada depois de a primeira
// entrega já ter chegado (src/features/queries/actions.ts).
export async function listUnprocessedEventIds(
  referenceId: string,
): Promise<string[]> {
  const { webhookEvents } = collections(await getDb());
  const docs = await webhookEvents
    .find(
      { referenceId, processingStatus: { $in: ["pending", "ignored"] } },
      { projection: { _id: 1 } },
    )
    .sort({ receivedAt: 1 })
    .toArray();
  return docs.map((doc) => doc._id);
}
