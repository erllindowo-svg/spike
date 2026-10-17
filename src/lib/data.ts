import "server-only";

// Camada de acesso aos dados usada pelas páginas e pelo layout. No
// protótipo, tudo vem dos dados fictícios de mock-data.ts, em memória: não há
// banco nem chamadas à JUDIT. O app real (branch main) lê o MongoDB.

import type { DocumentType, SearchType } from "@/lib/models";
import type { ActivityItem } from "@/features/activity/types";
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
  type SubjectView,
} from "@/features/subjects/view";
import type { AlertView } from "@/features/alerts/types";
import { normalizeDocument } from "@/features/parties/documents";
import type { Party } from "@/features/parties/types";
import { normalizeCnj } from "@/features/processes/cnj";
import type { Lawsuit } from "@/features/processes/types";
import { mergeQueries, type QueryView } from "@/features/queries/types";
import type { Tracking } from "@/features/trackings/types";
import type { WebhookEventView } from "@/features/webhooks/types";

import * as mock from "./mock-data";

export async function listParties(): Promise<Party[]> {
  return [...mock.parties].sort((a, b) =>
    (a.name ?? a.document).localeCompare(b.name ?? b.document, "pt-BR"),
  );
}

export async function getPartyByDocument(
  type: DocumentType,
  document: string,
): Promise<Party | null> {
  const normalized = normalizeDocument(type, document);
  return (
    mock.parties.find(
      (p) => p.documentType === type && p.document === normalized,
    ) ?? null
  );
}

export async function listLawsuits(filter?: {
  partyId?: string;
}): Promise<Lawsuit[]> {
  return mock.lawsuits
    .filter((l) => !filter?.partyId || l.partyId === filter.partyId)
    .sort(
      (a, b) =>
        (b.lastMovementAt?.getTime() ?? 0) - (a.lastMovementAt?.getTime() ?? 0),
    );
}

export async function getLawsuitByCnj(cnj: string): Promise<Lawsuit | null> {
  const normalized = normalizeCnj(cnj);
  return mock.lawsuits.find((l) => l.cnj === normalized) ?? null;
}

// O que já se sabe de um identificador, para a página Consultar (círculo
// 3B): o nome, os dados guardados e as consultas feitas.
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
  const [view, allQueries] = await Promise.all([
    getSubjectView(searchType, searchKey),
    listQueries(),
  ]);
  const queries = allQueries.filter(
    (q) => q.searchType === searchType && q.searchKey === searchKey,
  );
  const party =
    searchType === "cpf" || searchType === "cnpj"
      ? await getPartyByDocument(searchType, searchKey)
      : null;
  return {
    known: !!party || view.lawsuits.length > 0 || queries.length > 0,
    name: party?.name ?? (searchType === "name" ? searchKey : null),
    view,
    queries,
  };
}

// Busca da barra e do Acervo (círculo 3B): palavras que começam com o texto,
// nas entradas montadas com os dados fictícios. O identificador digitado vem
// primeiro.
export async function searchKnown(
  text: string,
  limit: number = SEARCH_LIMIT,
): Promise<SearchHit[]> {
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

// O que se sabe de um assunto (círculo 3, fatias 5 e 6): os processos
// fictícios da parte ou do número.
export async function getSubjectView(
  searchType: SearchType,
  searchKey: string,
): Promise<SubjectView> {
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

// Todas as consultas, síncronas e assíncronas (Acervo, barra de pesquisa e
// ficha do assunto): linhas fictícias.
export async function listQueries(): Promise<QueryView[]> {
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
  return {
    trackings: [...mock.trackings].sort(byDateDesc((t) => t.updatedAt)),
    alerts: [...mock.alerts].sort(byDateDesc((a) => a.createdAt)),
    webhookEvents: [...mock.webhookEvents].sort(
      byDateDesc((e) => e.receivedAt),
    ),
    activity: [...mock.activity].sort(byDateDesc((a) => a.occurredAt)),
  };
}

// Amostra de parâmetros para generateStaticParams. Com cacheComponents, rotas
// dinâmicas precisam de ao menos um parâmetro no build.
export const staticParamSamples = {
  subjects: () => [
    ...mock.parties.map((p) => ({ tipo: p.documentType, chave: p.document })),
    ...mock.lawsuits.map((l) => ({ tipo: "cnj", chave: l.cnj })),
  ],
};
