import type { Db } from "mongodb";

import type {
  Alert,
  Company,
  JuditRequest,
  Tracking,
  TrackingCreation,
  WebhookEvent,
} from "./models";

// Documento no MongoDB: o mesmo modelo, com `id` guardado em `_id`. Usamos um
// UUID em texto como `_id` (e não o ObjectId padrão) para que os
// identificadores sejam simples strings em toda a aplicação.
type Doc<T extends { id: string }> = Omit<T, "id"> & { _id: string };

export type CompanyDoc = Doc<Company>;
// Campos criados na etapa 4. Documentos gravados antes (etapa 2) não os
// têm; toTracking (src/features/trackings/db.ts) aplica os equivalentes.
type TrackingStage4Field =
  | "mode"
  | "creation"
  | "creationError"
  | "hourRange"
  | "delivery"
  | "lastCheckedAt";

export type TrackingDoc = Doc<Omit<Tracking, TrackingStage4Field>> &
  Partial<Pick<Tracking, TrackingStage4Field>> & {
    // true enquanto o monitoramento não foi excluído. Existe só para o índice
    // único parcial abaixo: o MongoDB não aceita "diferente de" ($ne) no filtro
    // de um índice parcial, então não dá para escrever "status != deleted".
    // Quem altera `status` precisa manter este campo coerente (activeFor).
    active: boolean;
  };
// Campos criados na etapa 6. Eventos gravados antes (etapa 5) não os têm;
// toWebhookEvent (src/features/webhooks/db.ts) usa null no lugar.
type WebhookEventStage6Field =
  "processingStartedAt" | "processingNote" | "duplicateDeliveries";
export type WebhookEventDoc = Doc<Omit<WebhookEvent, WebhookEventStage6Field>> &
  Partial<Pick<WebhookEvent, WebhookEventStage6Field>>;
export type AlertDoc = Doc<Alert>;
export type JuditRequestDoc = Doc<JuditRequest>;

export function collections(db: Db) {
  return {
    companies: db.collection<CompanyDoc>("companies"),
    trackings: db.collection<TrackingDoc>("trackings"),
    webhookEvents: db.collection<WebhookEventDoc>("webhook_events"),
    alerts: db.collection<AlertDoc>("alerts"),
    juditRequests: db.collection<JuditRequestDoc>("judit_requests"),
  };
}

// "deleted" é o status documentado pela JUDIT para monitoramento excluído.
// Uma criação recusada (`failed`) também libera o identificador. Linhas
// inativas continuam no banco como histórico.
export function activeFor(
  status: string | null,
  creation?: TrackingCreation,
): boolean {
  return status !== "deleted" && creation !== "failed";
}

export function toModel<T extends { _id: string }>(
  doc: T,
): Omit<T, "_id"> & { id: string } {
  const { _id, ...rest } = doc;
  return { id: _id, ...rest };
}

export const TRACKING_ACTIVE_KEY_INDEX = "trackings_active_search_key_unique";
export const JUDIT_REQUESTS_REQUEST_ID_INDEX =
  "judit_requests_request_id_unique";
export const WEBHOOK_EVENTS_CALLBACK_ID_INDEX =
  "webhook_events_callback_id_unique";
export const ALERTS_DEDUPE_KEY_INDEX = "alerts_dedupe_key_unique";

// Índices e regras de unicidade. O MongoDB não tem migrations como o SQL:
// createIndex é idempotente (não faz nada se o índice já existe igual), então
// é chamado na conexão. Mudar as opções de um índice existente exige
// removê-lo antes; isso fica para quando acontecer.
export async function ensureIndexes(db: Db): Promise<void> {
  const { companies, trackings, webhookEvents, alerts, juditRequests } =
    collections(db);

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
        name: WEBHOOK_EVENTS_CALLBACK_ID_INDEX,
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
    // Só para busca (alertas de um evento). A unicidade fica no índice de
    // baixo: um evento pode não gerar alerta, e o mesmo fato pode chegar em
    // dois eventos (versão do cache e versão atualizada).
    alerts.createIndex(
      { webhookEventId: 1 },
      { name: "alerts_webhook_event_id" },
    ),
    // Um alerta por fato (regra em src/features/webhooks/process.ts). Novo
    // nome de propósito: o MongoDB recusa um createIndex com o nome de um
    // índice existente e opções diferentes (`unique`).
    alerts.createIndex(
      { dedupeKey: 1 },
      {
        name: ALERTS_DEDUPE_KEY_INDEX,
        unique: true,
        partialFilterExpression: { dedupeKey: { $type: "string" } },
      },
    ),
    alerts.createIndex(
      { readAt: 1, createdAt: -1 },
      { name: "alerts_read_at_created_at" },
    ),

    // Um registro por consulta da JUDIT. A consulta é cobrada ao ser criada;
    // gravar o mesmo `request_id` duas vezes contaria a cobrança em dobro.
    juditRequests.createIndex(
      { requestId: 1 },
      { name: JUDIT_REQUESTS_REQUEST_ID_INDEX, unique: true },
    ),
    juditRequests.createIndex(
      { companyId: 1, createdAt: -1 },
      { name: "judit_requests_company_id_created_at" },
    ),
  ]);
}
