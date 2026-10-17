import "server-only";

import { cookies } from "next/headers";
import { connection } from "next/server";

// Camada de acesso aos dados usada pelas páginas e pelo layout. A variável
// DATA_SOURCE escolhe a origem para o app inteiro:
//
// - "demo" (padrão): dados fictícios de mock-data.ts, em memória.
// - "db": MongoDB: empresas, monitoramentos, consultas (assíncronas e o
//   registro das síncronas), eventos de webhook e alertas. Processos não são
//   copiados (continuam na JUDIT) e a atividade não é persistida; aparecem
//   vazios. Nada aqui chama a JUDIT.

import { getDb } from "@/db";
import type {
  Alert,
  DocumentType,
  SearchType,
  WebhookEvent,
} from "@/db/models";
import type { ActivityItem } from "@/features/activity/types";
import * as alertsDb from "@/features/alerts/db";
import * as baseDb from "@/features/base/db";
import { identify } from "@/features/consult/identify";
import { findSearchEntries, getSearchEntry } from "@/features/search/entries";
import {
  demoEntries,
  exactFirst,
  monitoredKeys,
  SEARCH_LIMIT,
  searchDemoEntries,
  toHit,
  type SearchHit,
} from "@/features/search/hits";
import {
  demoSubjectView,
  EMPTY_SUBJECT_VIEW,
  toSubjectView,
  type SubjectView,
} from "@/features/subjects/view";
import { isAlertType, type AlertView } from "@/features/alerts/types";
import { normalizeDocument } from "@/features/parties/documents";
import * as partiesDb from "@/features/parties/db";
import type { Party } from "@/features/parties/types";
import { normalizeCnj } from "@/features/processes/cnj";
import type { Lawsuit } from "@/features/processes/types";
import * as queriesDb from "@/features/queries/db";
import { SUPPORT_VIEW_COOKIE } from "@/features/settings/support-view-cookie";
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
import { LIST_LIMITS } from "@/lib/list-limits";

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

// Preferência da vista de suporte (support-view.tsx). No modo "db" a página
// já é desenhada a cada requisição, então ler o cookie não custa nada e a
// página nasce com a vista certa. Na demonstração, ler o cookie tiraria as
// páginas da pré-renderização; fica desligada até o navegador ler o cookie.
export async function getSupportViewPreference(): Promise<boolean> {
  if (!(await usingDatabase())) return false;
  const store = await cookies();
  return store.get(SUPPORT_VIEW_COOKIE)?.value === "on";
}

export async function listParties(): Promise<Party[]> {
  if (await usingDatabase()) return partiesDb.listParties();
  return [...mock.parties].sort((a, b) =>
    (a.name ?? a.document).localeCompare(b.name ?? b.document, "pt-BR"),
  );
}

export async function getPartyByDocument(
  type: DocumentType,
  document: string,
): Promise<Party | null> {
  if (await usingDatabase()) {
    return partiesDb.getPartyByDocument(type, document);
  }
  const normalized = normalizeDocument(type, document);
  return (
    mock.parties.find(
      (p) => p.documentType === type && p.document === normalized,
    ) ?? null
  );
}

// Processos virão da JUDIT (etapa 3 em diante); ainda não são persistidos.
export async function listLawsuits(filter?: {
  partyId?: string;
}): Promise<Lawsuit[]> {
  if (await usingDatabase()) return [];
  return mock.lawsuits
    .filter((l) => !filter?.partyId || l.partyId === filter.partyId)
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

// Busca da barra e do Acervo (círculo 3B): palavras que começam com o texto,
// em `search_entries` (banco) ou nas entradas montadas com os dados
// fictícios (demonstração). O identificador digitado vem primeiro.
export async function searchKnown(
  text: string,
  limit: number = SEARCH_LIMIT,
): Promise<SearchHit[]> {
  if (await usingDatabase()) {
    const db = await getDb();
    const entries = await findSearchEntries(db, text, limit);
    const result = identify(text);
    if (result.status === "recognized") {
      const { type, key } = result.candidates[0];
      const exact = await getSearchEntry(db, {
        searchType: type,
        searchKey: key,
      });
      if (exact && !entries.some((e) => e.id === exact.id)) {
        entries.unshift(exact);
      }
    }
    const monitored = monitoredKeys(await trackingsDb.listTrackings());
    return exactFirst(text, entries)
      .slice(0, limit)
      .map((entry) => toHit(entry, monitored));
  }
  const entries = demoEntries({
    parties: mock.parties,
    lawsuits: mock.lawsuits,
    queries: mock.queries,
    trackings: mock.trackings,
  });
  return exactFirst(text, searchDemoEntries(text, entries))
    .slice(0, limit)
    .map((entry) => toHit(entry, monitoredKeys(mock.trackings)));
}

// O que a base própria sabe de um assunto (círculo 3, fatias 5 e 6). Na
// demonstração, os processos fictícios da parte ou do número.
export async function getSubjectView(
  searchType: SearchType,
  searchKey: string,
): Promise<SubjectView> {
  if (await usingDatabase()) {
    return toSubjectView(
      await baseDb.getSubjectRecords({ searchType, searchKey }),
    );
  }
  if (searchType === "cnj") {
    const lawsuit = await getLawsuitByCnj(searchKey);
    return demoSubjectView(lawsuit ? [lawsuit] : []);
  }
  if (searchType === "cpf" || searchType === "cnpj") {
    const party = await getPartyByDocument(searchType, searchKey);
    return demoSubjectView(
      party ? await listLawsuits({ partyId: party.id }) : [],
    );
  }
  return EMPTY_SUBJECT_VIEW;
}

// Todas as consultas, síncronas e assíncronas (Acervo, barra de
// pesquisa e ficha do assunto). Na
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

// Quantos eventos a tela de diagnóstico mostra (src/lib/list-limits.ts).
const RECENT_EVENTS = LIST_LIMITS.webhookEvents;

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
  companies: () =>
    mock.parties
      .filter((p) => p.documentType === "cnpj")
      .map((p) => ({ cnpj: p.document })),
  people: () =>
    mock.parties
      .filter((p) => p.documentType === "cpf")
      .map((p) => ({ cpf: p.document })),
  lawsuits: () => mock.lawsuits.map((l) => ({ cnj: l.cnj })),
  subjects: () => [
    ...mock.parties.map((p) => ({ tipo: p.documentType, chave: p.document })),
    ...mock.lawsuits.map((l) => ({ tipo: "cnj", chave: l.cnj })),
  ],
};
