import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const trackingSearchTypeEnum = pgEnum("tracking_search_type", [
  "cnpj",
  "cnj",
]);

export const webhookProcessingStatusEnum = pgEnum("webhook_processing_status", [
  "pending",
  "processing",
  "processed",
  "failed",
  "ignored",
]);

export const companies = pgTable("companies", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Somente os 14 caracteres, sem máscara (aceita o CNPJ alfanumérico).
  cnpj: varchar("cnpj", { length: 14 }).notNull().unique(),
  legalName: text("legal_name"),
  registrationStatus: text("registration_status"),
  ...timestamps,
});

export const trackings = pgTable(
  "trackings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Nulo enquanto o monitoramento ainda não foi confirmado pela JUDIT.
    juditTrackingId: text("judit_tracking_id").unique(),
    companyId: uuid("company_id").references(() => companies.id, {
      onDelete: "set null",
    }),
    searchType: trackingSearchTypeEnum("search_type").notNull(),
    searchKey: text("search_key").notNull(),
    // Valor bruto informado pela JUDIT; mantido como texto para não quebrar
    // caso a API passe a retornar novos estados.
    status: text("status"),
    // Intervalo em dias entre execuções, conforme definido na JUDIT.
    recurrenceDays: integer("recurrence_days"),
    ...timestamps,
  },
  (table) => [
    index("trackings_company_id_idx").on(table.companyId),
    index("trackings_search_idx").on(table.searchType, table.searchKey),
    // No máximo um monitoramento não excluído por identificador. A regra fica
    // no banco, e não só no código, porque duas requisições simultâneas
    // passariam juntas por uma consulta prévia. "deleted" é o status
    // documentado pela JUDIT para monitoramento excluído; linhas excluídas
    // continuam no banco como histórico.
    uniqueIndex("trackings_active_search_key_unique")
      .on(table.searchType, table.searchKey)
      .where(sql`${table.status} IS DISTINCT FROM 'deleted'`),
    check(
      "trackings_recurrence_days_positive",
      sql`${table.recurrenceDays} IS NULL OR ${table.recurrenceDays} > 0`,
    ),
  ],
);

export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Identificador único da entrega; a restrição UNIQUE impede reprocessar
    // reentregas. Nulos são permitidos e não colidem entre si.
    callbackId: text("callback_id").unique(),
    eventType: text("event_type"),
    referenceType: text("reference_type"),
    referenceId: text("reference_id"),
    payload: jsonb("payload").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    processingStatus: webhookProcessingStatusEnum("processing_status")
      .notNull()
      .default("pending"),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    processingError: text("processing_error"),
  },
  (table) => [
    index("webhook_events_reference_id_idx").on(table.referenceId),
    index("webhook_events_processing_status_idx").on(
      table.processingStatus,
      table.receivedAt,
    ),
  ],
);

export const alerts = pgTable(
  "alerts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").references(() => companies.id, {
      onDelete: "set null",
    }),
    webhookEventId: uuid("webhook_event_id").references(
      () => webhookEvents.id,
      { onDelete: "set null" },
    ),
    title: text("title").notNull(),
    description: text("description"),
    type: text("type").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // Nulo indica alerta não lido.
    readAt: timestamp("read_at", { withTimezone: true }),
  },
  (table) => [
    index("alerts_company_id_idx").on(table.companyId),
    index("alerts_webhook_event_id_idx").on(table.webhookEventId),
    index("alerts_unread_idx")
      .on(table.createdAt)
      .where(sql`${table.readAt} IS NULL`),
  ],
);

export type Company = typeof companies.$inferSelect;
export type NewCompany = typeof companies.$inferInsert;
export type Tracking = typeof trackings.$inferSelect;
export type NewTracking = typeof trackings.$inferInsert;
export type WebhookEvent = typeof webhookEvents.$inferSelect;
export type NewWebhookEvent = typeof webhookEvents.$inferInsert;
export type Alert = typeof alerts.$inferSelect;
export type NewAlert = typeof alerts.$inferInsert;
