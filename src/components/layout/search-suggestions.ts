import {
  formatSearchKey,
  identify,
  SEARCH_TYPES,
} from "@/features/consult/identify";
import type { SearchHit } from "@/features/search/hits";
import { MIN_QUERY_LENGTH } from "@/features/search/terms";
import { subjectHref } from "@/features/subjects/subjects";

// O que a barra de pesquisa mostra (círculo 3B), como a barra do Google:
//
//   1. o melhor resultado do banco (o identificador digitado, se já foi
//      pesquisado, leva à ficha dele)
//   2. sempre "Fazer nova consulta", que abre a página Consultar preenchida
//   3. os outros resultados
//
// Sem resultados: "Dado não encontrado" (não clicável) e a nova consulta.
// Com o banco fora do ar: "Busca indisponível" e a nova consulta. A busca
// em si é feita no servidor (src/features/search/actions.ts).

export type SearchSuggestion =
  | {
      id: string;
      kind: "hit" | "consult";
      label: string;
      description: string;
      href: string;
    }
  | { id: string; kind: "notice"; label: string; description: string };

// `found`: null enquanto a busca não respondeu; "error" se falhou.
export function buildSuggestions(
  rawText: string,
  found: SearchHit[] | "error" | null,
): SearchSuggestion[] {
  const text = rawText.trim();
  if (text.replace(/[^0-9A-Za-zÀ-ÿ]/g, "").length < MIN_QUERY_LENGTH) {
    return [];
  }
  const consult = consultSuggestion(text);
  if (found === null) return [consult];
  if (found === "error") {
    return [
      {
        id: "notice",
        kind: "notice",
        label: "Busca indisponível agora",
        description: "O banco não respondeu. Tente de novo em instantes.",
      },
      consult,
    ];
  }
  if (found.length === 0) {
    return [
      {
        id: "notice",
        kind: "notice",
        label: "Dado não encontrado",
        description: "Nada no seu acervo começa com esse texto.",
      },
      consult,
    ];
  }
  const [first, ...rest] = found.map(hitSuggestion);
  return [first, consult, ...rest];
}

function hitSuggestion(hit: SearchHit): SearchSuggestion {
  return {
    id: `hit:${hit.searchType}:${hit.searchKey}`,
    kind: "hit",
    label: hit.label,
    description: hit.description,
    href: subjectHref(hit.searchType, hit.searchKey),
  };
}

function consultSuggestion(text: string): SearchSuggestion {
  const result = identify(text);
  if (result.status === "recognized") {
    const { type, key } = result.candidates[0];
    const what =
      type === "name"
        ? `“${key}”`
        : `${SEARCH_TYPES[type].label} ${formatSearchKey(type, key)}`;
    return {
      id: `consult:${type}:${key}`,
      kind: "consult",
      label: `Fazer nova consulta: ${what}`,
      description: "Abre a página Consultar. Cada consulta é cobrada.",
      href: `/?valor=${encodeURIComponent(key)}&tipo=${type}`,
    };
  }
  return {
    id: "consult:text",
    kind: "consult",
    label: `Fazer nova consulta: “${text}”`,
    description: "Abre a página Consultar com o texto digitado.",
    href: `/?valor=${encodeURIComponent(text)}`,
  };
}
