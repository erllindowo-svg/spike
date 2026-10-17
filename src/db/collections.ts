import type { Db } from "mongodb";

import type {
  Alert,
  Finding,
  LawsuitStats,
  Party,
  JuditRequest,
  SearchEntry,
  StoredLawsuit,
  StoredRegistration,
  StoredWarrant,
  SyncQuery,
  Tracking,
  TrackingCreation,
  WebhookEvent,
} from "./models";

// Documento no MongoDB: o mesmo modelo, com `id` guardado em `_id`. Usamos um
// UUID em texto como `_id` (e não o ObjectId padrão) para que os
// identificadores sejam simples strings em toda a aplicação.
type Doc<T extends { id: string }> = Omit<T, "id"> & { _id: string };

export type PartyDoc = Doc<Party>;
// Campos criados na etapa 4. Documentos gravados antes (etapa 2) não os
// têm; toTracking (src/features/trackings/db.ts) aplica os equivalentes.
type TrackingStage4Field =
  | "stepTerms"
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
export type SyncQueryDoc = Doc<SyncQuery>;
export type StoredLawsuitDoc = Doc<StoredLawsuit>;
export type StoredRegistrationDoc = Doc<StoredRegistration>;
export type StoredWarrantDoc = Doc<StoredWarrant>;
export type LawsuitStatsDoc = Doc<LawsuitStats>;
export type FindingDoc = Doc<Finding>;
export type SearchEntryDoc = Doc<SearchEntry>;
// Ajustes do app guardados no banco (círculo 5), um documento por ajuste,
// com o nome do ajuste no `_id`. Hoje só "cost-protection".
export type AppSettingDoc = {
  _id: "cost-protection";
  allowlist: boolean;
  updatedAt: Date;
};

export function collections(db: Db) {
  return {
    parties: db.collection<PartyDoc>("parties"),
    trackings: db.collection<TrackingDoc>("trackings"),
    webhookEvents: db.collection<WebhookEventDoc>("webhook_events"),
    alerts: db.collection<AlertDoc>("alerts"),
    juditRequests: db.collection<JuditRequestDoc>("judit_requests"),
    syncQueries: db.collection<SyncQueryDoc>("sync_queries"),
    // Base própria (círculo 3, fatia 5).
    lawsuits: db.collection<StoredLawsuitDoc>("lawsuits"),
    registrations: db.collection<StoredRegistrationDoc>("registrations"),
    warrants: db.collection<StoredWarrantDoc>("warrants"),
    lawsuitStats: db.collection<LawsuitStatsDoc>("lawsuit_stats"),
    findings: db.collection<FindingDoc>("findings"),
    // Busca (círculo 3B): derivada das coleções acima.
    searchEntries: db.collection<SearchEntryDoc>("search_entries"),
    appSettings: db.collection<AppSettingDoc>("app_settings"),
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
export const PARTIES_DOCUMENT_INDEX = "parties_document_unique";
export const LAWSUITS_KEY_INDEX = "lawsuits_cnj_instance_unique";
export const REGISTRATIONS_KEY_INDEX = "registrations_document_unique";
export const WARRANTS_KEY_INDEX = "warrants_key_unique";
export const LAWSUIT_STATS_KEY_INDEX = "lawsuit_stats_search_mode_unique";
export const FINDINGS_KEY_INDEX = "findings_subject_item_unique";
export const SEARCH_ENTRIES_KEY_INDEX = "search_entries_subject_unique";

// Índices e regras de unicidade. O MongoDB não tem migrations como o SQL:
// createIndex é idempotente (não faz nada se o índice já existe igual), então
// é chamado na conexão. Mudar as opções de um índice existente exige
// removê-lo antes; isso fica para quando acontecer.
export async function ensureIndexes(db: Db): Promise<void> {
  const {
    parties,
    trackings,
    webhookEvents,
    alerts,
    juditRequests,
    syncQueries,
    lawsuits,
    registrations,
    warrants,
    lawsuitStats,
    findings,
    searchEntries,
  } = collections(db);

  await Promise.all([
    // Uma parte por documento. O tipo entra na chave porque CNPJ e CPF são
    // números de famílias diferentes.
    parties.createIndex(
      { documentType: 1, document: 1 },
      { name: PARTIES_DOCUMENT_INDEX, unique: true },
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
    trackings.createIndex({ partyId: 1 }, { name: "trackings_party_id" }),
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

    alerts.createIndex({ partyId: 1 }, { name: "alerts_party_id" }),
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
      { partyId: 1, createdAt: -1 },
      { name: "judit_requests_party_id_created_at" },
    ),
    // Histórico da página Consultas, do mais novo para o mais antigo. Sem
    // regra de unicidade: cada chamada é um registro, e a JUDIT nem sempre
    // devolve um request_id.
    juditRequests.createIndex(
      { createdAt: -1 },
      { name: "judit_requests_created_at" },
    ),
    syncQueries.createIndex(
      { createdAt: -1 },
      { name: "sync_queries_created_at" },
    ),

    // Base própria: um registro por coisa. Os índices únicos são a regra de
    // "não duplicar" e também a da atualização: um upsert com conteúdo mais
    // velho esbarra no registro existente (src/features/base/db.ts).
    lawsuits.createIndex(
      { cnj: 1, instance: 1 },
      { name: LAWSUITS_KEY_INDEX, unique: true },
    ),
    registrations.createIndex(
      { documentType: 1, document: 1 },
      { name: REGISTRATIONS_KEY_INDEX, unique: true },
    ),
    warrants.createIndex(
      { key: 1 },
      { name: WARRANTS_KEY_INDEX, unique: true },
    ),
    lawsuitStats.createIndex(
      { searchType: 1, searchKey: 1, mode: 1 },
      { name: LAWSUIT_STATS_KEY_INDEX, unique: true },
    ),
    findings.createIndex(
      { searchType: 1, searchKey: 1, kind: 1, itemKey: 1 },
      { name: FINDINGS_KEY_INDEX, unique: true },
    ),
    // Quem encontrou este item (o processo visto de outro assunto).
    findings.createIndex({ kind: 1, itemKey: 1 }, { name: "findings_item" }),

    // Busca: uma entrada por assunto, e o índice das palavras. Num campo
    // que é uma lista, o MongoDB indexa cada palavra (índice "multikey"), e
    // uma expressão que fixa o começo (/^erl/) usa o índice em vez de ler a
    // coleção inteira.
    searchEntries.createIndex(
      { searchType: 1, searchKey: 1 },
      { name: SEARCH_ENTRIES_KEY_INDEX, unique: true },
    ),
    searchEntries.createIndex({ terms: 1 }, { name: "search_entries_terms" }),
    searchEntries.createIndex(
      { lastSeenAt: -1 },
      { name: "search_entries_last_seen_at" },
    ),
  ]);
}
