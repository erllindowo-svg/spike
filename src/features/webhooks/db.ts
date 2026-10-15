import "server-only";

import { randomUUID } from "node:crypto";

import { getDb } from "@/db";
import {
  collections,
  toModel,
  WEBHOOK_EVENTS_CALLBACK_ID_INDEX,
  type WebhookEventDoc,
} from "@/db/collections";
import { isDuplicateKeyError } from "@/db/errors";
import type { WebhookEvent } from "@/db/models";

import type { NewWebhookEvent } from "./envelope";

export type SavedWebhookEvent =
  { duplicate: false; event: WebhookEvent } | { duplicate: true; event: null };

// Grava uma entrega da JUDIT (coleção `webhook_events`) com status
// "pending": receber não é processar. Associar o evento à consulta ou ao
// monitoramento e gerar o alerta é a etapa 6.
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
    processedAt: null,
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
  return { duplicate: false, event: toModel(doc) };
}

// As entregas mais recentes primeiro. Usado pela rota de dev
// (src/app/api/dev/webhooks/route.ts) para conferir o teste real.
export async function listRecentWebhookEvents(
  limit: number,
): Promise<WebhookEvent[]> {
  const { webhookEvents } = collections(await getDb());
  const docs = await webhookEvents
    .find()
    .sort({ receivedAt: -1 })
    .limit(limit)
    .toArray();
  return docs.map(toModel);
}
