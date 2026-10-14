import type { Db } from "mongodb";

import type { Alert, Company, Tracking, WebhookEvent } from "./models";

// Documento no MongoDB: o mesmo modelo, com `id` guardado em `_id`. Usamos um
// UUID em texto como `_id` (e não o ObjectId padrão) para que os
// identificadores sejam simples strings em toda a aplicação.
type Doc<T extends { id: string }> = Omit<T, "id"> & { _id: string };

export type CompanyDoc = Doc<Company>;
export type TrackingDoc = Doc<Tracking> & {
  // true enquanto o monitoramento não foi excluído. Existe só para o índice
  // único parcial abaixo: o MongoDB não aceita "diferente de" ($ne) no filtro
  // de um índice parcial, então não dá para escrever "status != deleted".
  // Quem altera `status` precisa manter este campo coerente (activeFor).
  active: boolean;
};
export type WebhookEventDoc = Doc<WebhookEvent>;
export type AlertDoc = Doc<Alert>;

export function collections(db: Db) {
  return {
    companies: db.collection<CompanyDoc>("companies"),
    trackings: db.collection<TrackingDoc>("trackings"),
    webhookEvents: db.collection<WebhookEventDoc>("webhook_events"),
    alerts: db.collection<AlertDoc>("alerts"),
  };
}

// "deleted" é o status documentado pela JUDIT para monitoramento excluído.
// Linhas excluídas continuam no banco como histórico.
export function activeFor(status: string | null): boolean {
  return status !== "deleted";
}

export function toModel<T extends { _id: string }>(
  doc: T,
): Omit<T, "_id"> & { id: string } {
  const { _id, ...rest } = doc;
  return { id: _id, ...rest };
}

export const TRACKING_ACTIVE_KEY_INDEX = "trackings_active_search_key_unique";

// Índices e regras de unicidade. O MongoDB não tem migrations como o SQL:
// createIndex é idempotente (não faz nada se o índice já existe igual), então
// é chamado na conexão. Mudar as opções de um índice existente exige
// removê-lo antes; isso fica para quando acontecer.
export async function ensureIndexes(db: Db): Promise<void> {
  const { companies, trackings, webhookEvents, alerts } = collections(db);

  await Promise.all([
    companies.createIndex(
      { cnpj: 1 },
      { name: "companies_cnpj_unique", unique: true },
    ),

    // Só vale para IDs preenchidos: vários monitoramentos ainda não enviados
    // à JUDIT têm `juditTrackingId: null` e não podem colidir entre si.
    trackings.createIndex(
      { juditTrackingId: 1 },
      {
        name: "trackings_judit_tracking_id_unique",
        unique: true,
        partialFilterExpression: { juditTrackingId: { $type: "string" } },
      },
    ),
    trackings.createIndex({ companyId: 1 }, { name: "trackings_company_id" }),
    // No máximo um monitoramento não excluído por identificador. A regra fica
    // no banco, e não só no código, porque duas requisições simultâneas
    // passariam juntas por uma consulta prévia.
    trackings.createIndex(
      { searchType: 1, searchKey: 1 },
      {
        name: TRACKING_ACTIVE_KEY_INDEX,
        unique: true,
        partialFilterExpression: { active: true },
      },
    ),

    // Identificador único da entrega: impede reprocessar reentregas. Eventos
    // sem callbackId não colidem entre si.
    webhookEvents.createIndex(
      { callbackId: 1 },
      {
        name: "webhook_events_callback_id_unique",
        unique: true,
        partialFilterExpression: { callbackId: { $type: "string" } },
      },
    ),
    webhookEvents.createIndex(
      { referenceId: 1 },
      { name: "webhook_events_reference_id" },
    ),
    webhookEvents.createIndex(
      { processingStatus: 1, receivedAt: 1 },
      { name: "webhook_events_processing_status" },
    ),

    alerts.createIndex({ companyId: 1 }, { name: "alerts_company_id" }),
    alerts.createIndex(
      { webhookEventId: 1 },
      { name: "alerts_webhook_event_id" },
    ),
    alerts.createIndex(
      { readAt: 1, createdAt: -1 },
      { name: "alerts_read_at_created_at" },
    ),
  ]);
}
