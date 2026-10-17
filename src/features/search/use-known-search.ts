"use client";

import { useEffect, useState } from "react";

import { searchKnownAction } from "./actions";
import type { SearchHit } from "./hits";
import { parseQuery } from "./terms";

const DEBOUNCE_MS = 300;

// Busca no acervo enquanto se digita: uma chamada por pausa na digitação
// (300 ms), só a partir de 3 caracteres. Uma resposta atrasada de um texto
// antigo é descartada. Devolve null enquanto não há resposta para o texto
// atual, e "error" se o banco não respondeu.
export function useKnownSearch(
  text: string,
  limit?: number,
): SearchHit[] | "error" | null {
  const [state, setState] = useState<{
    text: string;
    result: SearchHit[] | "error";
  } | null>(null);
  const searchable = parseQuery(text) !== null;

  useEffect(() => {
    if (!searchable) return;
    let current = true;
    const timer = setTimeout(async () => {
      try {
        const response = await searchKnownAction(text, limit);
        if (current) {
          setState({ text, result: response.ok ? response.hits : "error" });
        }
      } catch {
        if (current) setState({ text, result: "error" });
      }
    }, DEBOUNCE_MS);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [text, searchable, limit]);

  return searchable && state?.text === text ? state.result : null;
}
