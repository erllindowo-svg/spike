"use server";

import { searchKnown } from "@/lib/data";

import { SEARCH_LIMIT, type SearchHit } from "./hits";

export type SearchResult = { ok: true; hits: SearchHit[] } | { ok: false };

// A barra de pesquisa e o filtro do Acervo chamam esta action enquanto se
// digita (com uma pausa entre as teclas). Lê os dados fictícios: não
// consulta a JUDIT. Uma falha é diferente de "nada encontrado", e a tela diz
// qual das duas aconteceu.
export async function searchKnownAction(
  text: string,
  // A barra mostra poucos; o filtro do Acervo, mais. Nunca acima de 50.
  limit: number = SEARCH_LIMIT,
): Promise<SearchResult> {
  if (typeof text !== "string" || text.length > 200) {
    return { ok: true, hits: [] };
  }
  const safeLimit = Math.min(Math.max(Math.trunc(limit) || 1, 1), 50);
  try {
    return { ok: true, hits: await searchKnown(text, safeLimit) };
  } catch (error) {
    console.error(
      "[search] falha na busca:",
      error instanceof Error ? error.message : String(error),
    );
    return { ok: false };
  }
}
