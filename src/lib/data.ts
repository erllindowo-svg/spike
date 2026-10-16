import "server-only";

import { connection } from "next/server";

// Camada de acesso aos dados usada pelas páginas e pelo layout. A variável
// DATA_SOURCE escolhe a origem para o app inteiro:
//
// - "demo" (padrão): dados fictícios de mock-data.ts, em memória.
// - "db": MongoDB: empresas, monitoramentos, consultas (assíncronas e o
//   registro das síncronas), eventos de webhook e alertas. Processos não são
//   copiados (continuam na JUDIT) e a atividade não é persistida; aparecem
//   vazios. Nada aqui chama a JUDIT.

import type { Alert, JuditRequest, WebhookEvent } from "@/db/models";
import type { ActivityItem } from "@/features/activity/types";
import * as alertsDb from "@/features/alerts/db";
import { isAlertType, type AlertView } from "@/features/alerts/types";
import { normalizeCnpj } from "@/features/companies/cnpj";
import * as companiesDb from "@/features/companies/db";
import type { Company } from "@/features/companies/types";
import { normalizeCnj } from "@/features/processes/cnj";
import type { Lawsuit } from "@/features/processes/types";
import * as queriesDb from "@/features/queries/db";
import {
  fromJuditRequest,
  fromSyncQuery,
  mergeQueries,
  type QueryView,
} from "@/features/queries/types";
import * as trackingsDb from "@/features/trackings/db";
import type { Tracking } from "@/features/trackings/types";
import * as webhooksDb from "@/features/webhooks/db";
import type { WebhookEventView } from "@/features/webhooks/types";
import { getServerEnv } from "@/lib/env";

import * as mock from "./mock-data";

export type DataSource = "demo" | "db";

export function getDataSource(): DataSource {
  return getServerEnv("DATA_SOURCE");
}

// No modo "db", espera a requisição chegar antes de consultar o banco. Sem
// isso, o Next tentaria consultar o MongoDB durante o build (prerender) e
// congelaria o resultado na página. Os dados de demonstração continuam sendo
// pré-renderizados como antes.
async function usingDatabase(): Promise<boolean> {
  if (getDataSource() !== "db") return false;
  await connection();
  return true;
}

export async function listCompanies(): Promise<Company[]> {
  if (await usingDatabase()) return companiesDb.listCompanies();
  return [...mock.companies].sort((a, b) =>
    (a.legalName ?? a.cnpj).localeCompare(b.legalName ?? b.cnpj, "pt-BR"),
  );
}

export async function getCompanyByCnpj(cnpj: string): Promise<Company | null> {
  if (await usingDatabase()) return companiesDb.getCompanyByCnpj(cnpj);
  const normalized = normalizeCnpj(cnpj);
  return mock.companies.find((c) => c.cnpj === normalized) ?? null;
}

// Processos virão da JUDIT (etapa 3 em diante); ainda não são persistidos.
export async function listLawsuits(filter?: {
  companyId?: string;
}): Promise<Lawsuit[]> {
  if (await usingDatabase()) return [];
  return mock.lawsuits
    .filter((l) => !filter?.companyId || l.companyId === filter.companyId)
    .sort(
      (a, b) =>
        (b.lastMovementAt?.getTime() ?? 0) - (a.lastMovementAt?.getTime() ?? 0),
    );
}

export async function getLawsuitByCnj(cnj: string): Promise<Lawsuit | null> {
  if (await usingDatabase()) return null;
  const normalized = normalizeCnj(cnj);
  return mock.lawsuits.find((l) => l.cnj === normalized) ?? null;
}

// Consultas assíncronas criadas na JUDIT (coleção judit_requests). Só existem
// no modo "db": a demonstração não chama a JUDIT.
export async function listAsyncQueries(
  companyId: string,
): Promise<JuditRequest[]> {
  if (await usingDatabase()) return queriesDb.listJuditRequests(companyId);
  return [];
}

// Todas as consultas, síncronas e assíncronas, para a página Consultas. Na
// demonstração, linhas fictícias no mesmo formato.
export async function listQueries(): Promise<QueryView[]> {
  if (await usingDatabase()) {
    const [requests, syncQueries] = await Promise.all([
      queriesDb.listRecentJuditRequests(),
      queriesDb.listSyncQueries(),
    ]);
    return mergeQueries(
      requests.map(fromJuditRequest),
      syncQueries.map(fromSyncQuery),
    );
  }
  return mergeQueries(mock.queries);
}

// "Agora" para as contagens por período do Dashboard. Na demonstração, a data
// fixa dos dados fictícios (senão os gráficos ficariam vazios com o passar
// dos dias); no modo "db", a hora da requisição.
export async function getReferenceDate(): Promise<Date> {
  if (await usingDatabase()) return new Date();
  return mock.DEMO_NOW;
}

const byDateDesc =
  <T>(key: (item: T) => Date) =>
  (a: T, b: T) =>
    key(b).getTime() - key(a).getTime();

export type DemoState = {
  trackings: Tracking[];
  alerts: AlertView[];
  webhookEvents: WebhookEventView[];
  activity: ActivityItem[];
};

// Coleções que a interface mantém no estado do navegador (demo-store.tsx).
export async function getInitialState(): Promise<DemoState> {
  if (await usingDatabase()) {
    const [trackings, alerts, events] = await Promise.all([
      trackingsDb.listTrackings(),
      alertsDb.listAlerts(),
      webhooksDb.listRecentWebhookEvents(RECENT_EVENTS),
    ]);
    return {
      trackings,
      alerts: alerts.flatMap(toAlertView),
      webhookEvents: events.map((event) => toEventView(event, alerts)),
      activity: [],
    };
  }
  return {
    trackings: [...mock.trackings].sort(byDateDesc((t) => t.updatedAt)),
    alerts: [...mock.alerts].sort(byDateDesc((a) => a.createdAt)),
    webhookEvents: [...mock.webhookEvents].sort(
      byDateDesc((e) => e.receivedAt),
    ),
    activity: [...mock.activity].sort(byDateDesc((a) => a.occurredAt)),
  };
}

// Quantos eventos a tela de diagnóstico mostra. Sem paginação: volume de
// protótipo.
const RECENT_EVENTS = 200;

// O banco guarda `type` como texto; um valor que a interface não conhece não
// derruba a tela, só fica de fora (e aparece no log).
function toAlertView(alert: Alert): AlertView[] {
  if (isAlertType(alert.type)) return [{ ...alert, type: alert.type }];
  console.warn(`[alerts] tipo desconhecido ignorado na tela: ${alert.type}`);
  return [];
}

function toEventView(event: WebhookEvent, alerts: Alert[]): WebhookEventView {
  return {
    ...event,
    alertIds: alerts
      .filter((alert) => alert.webhookEventId === event.id)
      .map((alert) => alert.id),
  };
}

// Amostra de parâmetros para generateStaticParams. Com cacheComponents, rotas
// dinâmicas precisam de ao menos um parâmetro no build; vem sempre da
// demonstração para que o build nunca dependa do banco. No modo "db", as
// páginas desses parâmetros só consultam o banco na requisição.
export const staticParamSamples = {
  companies: () => mock.companies.map((c) => ({ cnpj: c.cnpj })),
  lawsuits: () => mock.lawsuits.map((l) => ({ cnj: l.cnj })),
};
