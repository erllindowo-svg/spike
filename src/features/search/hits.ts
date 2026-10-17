import type { SearchEntry, SearchType, Tracking } from "@/db/models";
import { identify, SEARCH_TYPES } from "@/features/consult/identify";
import { formatSearchKey } from "@/features/trackings/format";
import {
  getTrackingDisplayState,
  isTrackingClosed,
} from "@/features/trackings/types";
import { formatDate, formatNumber } from "@/lib/format";

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
