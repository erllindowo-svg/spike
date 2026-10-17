import type { SearchType } from "@/db/models";
import {
  formatSearchKey as formatKey,
  identify,
  SEARCH_TYPES,
} from "@/features/consult/identify";
import { QUERY_MODES } from "@/features/queries/modes";
import type { QueryView } from "@/features/queries/types";
import {
  subjectHref,
  subjectKey,
  type Subject,
} from "@/features/subjects/subjects";
import { formatSearchKey } from "@/features/trackings/format";
import { formatDate } from "@/lib/format";

// Sugestões da barra de pesquisa (círculo 3, fatia 7). A barra é o atalho
// para as duas páginas: primeiro o que já está no banco (os assuntos e,
// quando o que foi digitado é o próprio identificador, as consultas feitas
// sobre ele, com a data); por último, discreto, "Consultar", que abre a
// página Consultar já preenchida. Nada é consultado só por digitar.

export type SearchSuggestion = {
  id: string;
  kind: "subject" | "query" | "consult";
  label: string;
  description: string;
  href: string;
};

const MAX_SUBJECTS = 5;
const MAX_QUERIES = 3;

export function buildSuggestions(
  rawQuery: string,
  data: { subjects: Subject[]; queries: QueryView[] },
): SearchSuggestion[] {
  const query = rawQuery.trim();
  if (query.length < 2) return [];

  const term = query.toLowerCase();
  const compact = query.toUpperCase().replace(/[^0-9A-Z]/g, "");
  const identification = identify(query);
  const target =
    identification.status === "recognized"
      ? identification.candidates[0]
      : null;

  // Assuntos: pelo nome ou por parte da chave (3 caracteres ou mais).
  const subjects = data.subjects.filter(
    (s) =>
      !!s.name?.toLowerCase().includes(term) ||
      (compact.length >= 3 && s.searchKey.toUpperCase().includes(compact)),
  );
  // O assunto do identificador digitado vem antes dos parecidos.
  if (target) {
    const exact = subjectKey(target.type, target.key);
    subjects.sort(
      (a, b) =>
        Number(subjectKey(b.searchType, b.searchKey) === exact) -
        Number(subjectKey(a.searchType, a.searchKey) === exact),
    );
  }

  const suggestions: SearchSuggestion[] = subjects
    .slice(0, MAX_SUBJECTS)
    .map((s) => ({
      id: `subject:${subjectKey(s.searchType, s.searchKey)}`,
      kind: "subject",
      label: s.name ?? formatSearchKey(s.searchType, s.searchKey),
      description: subjectDescription(s),
      href: subjectHref(s.searchType, s.searchKey),
    }));

  // As consultas já feitas sobre o identificador digitado, para reabrir.
  if (target) {
    for (const q of data.queries
      .filter((q) => q.searchType === target.type && q.searchKey === target.key)
      .slice(0, MAX_QUERIES)) {
      suggestions.push({
        id: `query:${q.id}`,
        kind: "query",
        label: QUERY_MODES[q.mode].label,
        description: `Consulta de ${formatDate(q.createdAt)}`,
        href: subjectHref(q.searchType, q.searchKey),
      });
    }
  }

  const consult = consultSuggestion(target);
  if (consult) suggestions.push(consult);
  return suggestions;
}

function subjectDescription(s: Subject): string {
  return [
    SEARCH_TYPES[s.searchType].label,
    s.name && s.searchType !== "name"
      ? formatSearchKey(s.searchType, s.searchKey)
      : null,
    s.monitored ? "monitorado" : null,
    s.lastQueryAt ? `consultado em ${formatDate(s.lastQueryAt)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function consultSuggestion(
  target: { type: SearchType; key: string } | null,
): SearchSuggestion | null {
  if (!target) return null;
  const what =
    target.type === "name"
      ? `“${target.key}”`
      : `${SEARCH_TYPES[target.type].label} ${formatKey(target.type, target.key)}`;
  return {
    id: `consult:${target.type}:${target.key}`,
    kind: "consult",
    label: `Consultar ${what}`,
    description: "Abre a página Consultar. Cada consulta é cobrada.",
    href: `/?valor=${encodeURIComponent(target.key)}&tipo=${target.type}`,
  };
}
