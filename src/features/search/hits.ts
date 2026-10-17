import type { SearchEntry, SearchType, Tracking } from "@/db/models";
import { identify, SEARCH_TYPES } from "@/features/consult/identify";
import type { QueryView } from "@/features/queries/types";
import type { Lawsuit } from "@/features/processes/types";
import type { Party } from "@/features/parties/types";
import { formatSearchKey } from "@/features/trackings/format";
import {
  getTrackingDisplayState,
  isTrackingClosed,
} from "@/features/trackings/types";
import { formatDate, formatNumber } from "@/lib/format";

import { buildTerms, matchesTerms, parseQuery } from "./terms";

// Um resultado da busca, pronto para a barra e para o Acervo. Funções puras.

export type SearchHit = {
  searchType: SearchType;
  searchKey: string;
  label: string;
  description: string;
  monitored: boolean;
};

export const SEARCH_LIMIT = 8;

type EntryLike = Pick<
  SearchEntry,
  "searchType" | "searchKey" | "name" | "detail" | "lawsuits" | "lastSeenAt"
>;

// Monitorado: algum monitoramento vigiando (não pausado nem encerrado),
// como em src/features/subjects/subjects.ts.
export function monitoredKeys(trackings: Tracking[]): Set<string> {
  return new Set(
    trackings
      .filter(
        (t) => !isTrackingClosed(t) && getTrackingDisplayState(t) !== "paused",
      )
      .map((t) => `${t.searchType}:${t.searchKey}`),
  );
}

export function toHit(entry: EntryLike, monitored: Set<string>): SearchHit {
  const key = formatSearchKey(entry.searchType, entry.searchKey);
  const isMonitored = monitored.has(`${entry.searchType}:${entry.searchKey}`);
  return {
    searchType: entry.searchType,
    searchKey: entry.searchKey,
    // O CPF entra mascarado (formatSearchKey), como nas outras listas.
    label: entry.name ?? key,
    description: [
      SEARCH_TYPES[entry.searchType].label,
      entry.name && entry.searchType !== "name" ? key : null,
      entry.detail,
      entry.lawsuits > 0
        ? `${formatNumber(entry.lawsuits)} ${entry.lawsuits === 1 ? "processo guardado" : "processos guardados"}`
        : null,
      isMonitored ? "monitorado" : null,
      `última atividade em ${formatDate(entry.lastSeenAt)}`,
    ]
      .filter(Boolean)
      .join(" · "),
    monitored: isMonitored,
  };
}

// O identificador digitado, quando já está no banco, vem primeiro: é o
// "link da página que você já acessou" da barra do Google.
export function exactFirst<T extends EntryLike>(
  text: string,
  entries: T[],
): T[] {
  const result = identify(text);
  if (result.status !== "recognized") return entries;
  const { type, key } = result.candidates[0];
  const exact = entries.filter(
    (e) => e.searchType === type && e.searchKey === key,
  );
  return [...exact, ...entries.filter((e) => !exact.includes(e))];
}

// Demonstração: as entradas montadas em memória com os dados fictícios, pela
// mesma regra de termos do banco.
export function demoEntries(data: {
  parties: Party[];
  lawsuits: Lawsuit[];
  queries: QueryView[];
  trackings: Tracking[];
}): (EntryLike & { terms: string[] })[] {
  const entries = new Map<string, EntryLike & { terms: string[] }>();
  const put = (
    searchType: SearchType,
    searchKey: string,
    at: Date,
    extra: Partial<EntryLike> & { texts?: (string | null)[] } = {},
  ) => {
    const id = `${searchType}:${searchKey}`;
    const current = entries.get(id);
    const name =
      extra.name ?? current?.name ?? (searchType === "name" ? searchKey : null);
    entries.set(id, {
      searchType,
      searchKey,
      name,
      detail: extra.detail ?? current?.detail ?? null,
      lawsuits: extra.lawsuits ?? current?.lawsuits ?? 0,
      lastSeenAt: current && current.lastSeenAt > at ? current.lastSeenAt : at,
      terms: [
        ...new Set([
          ...(current?.terms ?? []),
          ...buildTerms([name, ...(extra.texts ?? [])], [searchKey]),
        ]),
      ],
    });
  };

  for (const party of data.parties) {
    put(party.documentType, party.document, party.updatedAt, {
      name: party.name,
      detail: party.registrationStatus,
      lawsuits: data.lawsuits.filter((l) => l.partyId === party.id).length,
    });
  }
  for (const l of data.lawsuits) {
    put("cnj", l.cnj, l.lastMovementAt ?? new Date(0), {
      detail: [l.tribunal, l.area].filter(Boolean).join(" · ") || null,
      texts: [l.tribunal, l.area, l.className, l.subject, l.judgingBody],
    });
  }
  for (const q of data.queries) put(q.searchType, q.searchKey, q.createdAt);
  for (const t of data.trackings) put(t.searchType, t.searchKey, t.updatedAt);
  return [...entries.values()];
}

export function searchDemoEntries(
  text: string,
  entries: (EntryLike & { terms: string[] })[],
): EntryLike[] {
  const query = parseQuery(text);
  if (!query) return [];
  return entries
    .filter((e) => matchesTerms(e.terms, query))
    .sort((a, b) => b.lastSeenAt.getTime() - a.lastSeenAt.getTime());
}
