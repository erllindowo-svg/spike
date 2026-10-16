import "server-only";

import { randomUUID } from "node:crypto";

import { getDb } from "@/db";
import {
  ALERTS_DEDUPE_KEY_INDEX,
  collections,
  toModel,
} from "@/db/collections";
import { isDuplicateKeyError } from "@/db/errors";
import type { Alert } from "@/db/models";

import type { AlertType } from "./types";

// Persistência dos alertas (coleção `alerts`). Quem decide QUANDO um alerta
// nasce é o processamento dos webhooks (src/features/webhooks/process.ts);
// aqui ficam só a gravação e a leitura.

export type NewAlert = Pick<
  Alert,
  | "partyId"
  | "webhookEventId"
  | "trackingId"
  | "lawsuitCnj"
  | "dedupeKey"
  | "title"
  | "description"
> & { type: AlertType };

export type CreatedAlert =
  { created: true; alert: Alert } | { created: false; alert: null };

// Um alerta com o mesmo `dedupeKey` é recusado pelo índice único e volta
// como `created: false`, sem erro: o fato já foi avisado. Como em
// saveWebhookEvent, a regra fica no índice, e não numa consulta prévia.
export async function createAlert(input: NewAlert): Promise<CreatedAlert> {
  const { alerts } = collections(await getDb());
  const doc = {
    _id: randomUUID(),
    ...input,
    createdAt: new Date(),
    readAt: null,
  };
  try {
    await alerts.insertOne(doc);
  } catch (error) {
    if (isDuplicateKeyError(error, ALERTS_DEDUPE_KEY_INDEX)) {
      return { created: false, alert: null };
    }
    throw error;
  }
  return { created: true, alert: toModel(doc) };
}

// Os mais recentes primeiro. Sem paginação: volume de protótipo.
export async function listAlerts(limit = 200): Promise<Alert[]> {
  const { alerts } = collections(await getDb());
  const docs = await alerts
    .find()
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
  return docs.map(toModel);
}

// Só marca o que ainda não foi lido: a data da primeira leitura é mantida.
export async function markAlertRead(id: string): Promise<boolean> {
  const { alerts } = collections(await getDb());
  const result = await alerts.updateOne(
    { _id: id, readAt: null },
    { $set: { readAt: new Date() } },
  );
  return result.modifiedCount === 1;
}

// Sem `trackingId`, todos; com ele, só os alertas daquele monitoramento.
export async function markAllAlertsRead(trackingId?: string): Promise<number> {
  const { alerts } = collections(await getDb());
  const result = await alerts.updateMany(
    { readAt: null, ...(trackingId ? { trackingId } : {}) },
    { $set: { readAt: new Date() } },
  );
  return result.modifiedCount;
}
