import "server-only";

import { cookies } from "next/headers";
import { connection } from "next/server";

// Camada de acesso aos dados usada pelas páginas e pelo layout: tudo vem do
// MongoDB (partes, monitoramentos, consultas, base própria, eventos de
// webhook e alertas). Nada aqui chama a JUDIT.

import { getDb } from "@/db";
import type { Alert, SearchType, WebhookEvent } from "@/db/models";
import * as alertsDb from "@/features/alerts/db";
import * as baseDb from "@/features/base/db";
import { identify } from "@/features/consult/identify";
import { findSearchEntries, getSearchEntry } from "@/features/search/entries";
import {
  exactFirst,
  monitoredKeys,
  SEARCH_LIMIT,
  toHit,
  type SearchHit,
} from "@/features/search/hits";
import {
  EMPTY_SUBJECT_VIEW,
  toSubjectView,
  type SubjectView,
} from "@/features/subjects/view";
import { isAlertType, type AlertView } from "@/features/alerts/types";
import * as partiesDb from "@/features/parties/db";
import type { Party } from "@/features/parties/types";
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
import { hasServerEnv } from "@/lib/env";
import { LIST_LIMITS } from "@/lib/list-limits";

// As páginas leem o banco na requisição, e não no build: sem isso, o Next
// tentaria consultar o MongoDB durante o prerender e congelaria o resultado.
// Sem MONGODB_URI, o layout mostra a tela de configuração; as páginas, que o
// Next desenha em paralelo com o layout, recebem listas vazias em vez de
// quebrar (e encher o log de erros).
async function databaseReady(): Promise<boolean> {
  await connection();
  return hasServerEnv("MONGODB_URI");
}

// Preferência da vista de suporte (support-view.tsx). A página já é
// desenhada a cada requisição, então ler o cookie não custa nada e a página
// nasce com a vista certa.
export async function getSupportViewPreference(): Promise<boolean> {
  await connection();
  const store = await cookies();
  return store.get(SUPPORT_VIEW_COOKIE)?.value === "on";
}

export async function listParties(): Promise<Party[]> {
  if (!(await databaseReady())) return [];
  return partiesDb.listParties();
}

// O que já se sabe de um identificador, para a página Consultar (círculo
// 3B): o nome (search_entries), os dados guardados e as consultas feitas.
// `known` diz se há alguma coisa: só então a página se recolhe e mostra o
// "Já capturado".
export type SubjectContext = {
  known: boolean;
  name: string | null;
  view: SubjectView;
  queries: QueryView[];
};

export async function getSubjectContext(
  searchType: SearchType,
  searchKey: string,
): Promise<SubjectContext> {
  if (!(await databaseReady())) {
    return { known: false, name: null, view: EMPTY_SUBJECT_VIEW, queries: [] };
  }
  const [view, allQueries] = await Promise.all([
    getSubjectView(searchType, searchKey),
    listQueries(),
  ]);
  const queries = allQueries.filter(
    (q) => q.searchType === searchType && q.searchKey === searchKey,
  );
  const entry = await getSearchEntry(await getDb(), { searchType, searchKey });
  return { known: !!entry, name: entry?.name ?? null, view, queries };
}

// Busca da barra e do Acervo (círculo 3B): palavras que começam com o texto,
// em `search_entries`. O identificador digitado vem primeiro.
export async function searchKnown(
  text: string,
  limit: number = SEARCH_LIMIT,
): Promise<SearchHit[]> {
  if (!(await databaseReady())) return [];
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

// O que a base própria sabe de um assunto (círculo 3, fatias 5 e 6).
export async function getSubjectView(
  searchType: SearchType,
  searchKey: string,
): Promise<SubjectView> {
  if (!(await databaseReady())) return EMPTY_SUBJECT_VIEW;
  return toSubjectView(
    await baseDb.getSubjectRecords({ searchType, searchKey }),
  );
}

// Todas as consultas, síncronas e assíncronas (Acervo, barra de pesquisa e
// ficha do assunto).
export async function listQueries(): Promise<QueryView[]> {
  if (!(await databaseReady())) return [];
  const [requests, syncQueries] = await Promise.all([
    queriesDb.listRecentJuditRequests(),
    queriesDb.listSyncQueries(),
  ]);
  return mergeQueries(
    requests.map(fromJuditRequest),
    syncQueries.map(fromSyncQuery),
  );
}

export type AppState = {
  trackings: Tracking[];
  alerts: AlertView[];
  webhookEvents: WebhookEventView[];
};

// Coleções que as telas compartilham no navegador (app-store.tsx).
export async function getInitialState(): Promise<AppState> {
  if (!(await databaseReady())) {
    return { trackings: [], alerts: [], webhookEvents: [] };
  }
  const [trackings, alerts, events] = await Promise.all([
    trackingsDb.listTrackings(),
    alertsDb.listAlerts(),
    webhooksDb.listRecentWebhookEvents(RECENT_EVENTS),
  ]);
  return {
    trackings,
    alerts: alerts.flatMap(toAlertView),
    webhookEvents: events.map((event) => toEventView(event, alerts)),
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
// dinâmicas precisam de ao menos um parâmetro no build; um identificador
// fictício basta, porque a página só lê o banco na requisição.
export const staticParamSamples = {
  subjects: () => [{ tipo: "cnpj", chave: "A1B2C3D4E5F668" }],
};
