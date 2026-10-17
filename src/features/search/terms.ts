// Termos de busca (círculo 3B, opção B). Cada entrada da busca guarda as
// palavras pesquisáveis em minúsculas e sem acento (`terms`), num campo com
// índice comum do MongoDB. A busca acha as palavras que COMEÇAM com o que
// foi digitado ("erl" acha "Erllan"), como a barra do Google; o meio da
// palavra ("llan") não é achado. Funções puras: o banco
// (src/features/search/entries.ts) e a demonstração usam as mesmas.

import { formatSearchKey } from "@/features/consult/identify";
import type { SearchType } from "@/db/models";
import { cnjStates } from "@/features/processes/cnj-states";

export const MIN_QUERY_LENGTH = 3;

// Versão das regras de buildTerms, gravada em cada entrada. Ao mudar as
// regras, aumente o número: na conexão, as entradas de versão antiga são
// remontadas (src/features/search/entries.ts). 2: grupos do número
// formatado; 3: estados do tribunal de um CNJ (círculo 5).
export const TERMS_VERSION = 3;

// Números que têm máscara: os grupos dela também viram termos.
const GROUPED_TYPES: ReadonlySet<SearchType> = new Set(["cpf", "cnpj", "cnj"]);

// "Ação Cível" -> "acao civel".
export function normalizeText(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// Palavras de um texto: letras e dígitos, sem pontuação.
export function tokensOf(value: string | null | undefined): string[] {
  if (!value) return [];
  return normalizeText(value)
    .split(/[^0-9a-z]+/)
    .filter((token) => token.length > 0);
}

// Um número sem a máscara ("A1.B2C.3D4/E5F6-68" -> "a1b2c3d4e5f668").
export function compactOf(value: string): string {
  return normalizeText(value).replace(/[^0-9a-z]/g, "");
}

// Os termos de uma entrada: as palavras dos textos, as chaves inteiras e,
// em CPF, CNPJ e CNJ, cada grupo do número formatado (529.982.247-25 dá
// "529", "982", "247" e "25"), para achar o número pelo meio, como no CPF
// mascarado das listas (círculo 5). Num CNJ, também o estado do tribunal
// ("sao", "paulo", "sp"), tirado do próprio número (cnj-states.ts). Sem
// repetição.
export function buildTerms(
  texts: (string | null | undefined)[],
  keys: string[],
  type?: SearchType,
): string[] {
  const terms = new Set<string>();
  for (const text of texts)
    for (const token of tokensOf(text)) terms.add(token);
  for (const key of keys) {
    const compact = compactOf(key);
    if (compact) terms.add(compact);
    if (type && GROUPED_TYPES.has(type)) {
      for (const group of tokensOf(formatSearchKey(type, key))) {
        terms.add(group);
      }
    }
    if (type === "cnj") {
      for (const state of cnjStates(key)) {
        for (const token of tokensOf(`${state.name} ${state.uf}`)) {
          terms.add(token);
        }
      }
    }
  }
  return [...terms];
}

export type SearchQuery = { tokens: string[]; compact: string };

// O que foi digitado, pronto para buscar. Null abaixo do mínimo: com uma ou
// duas letras, quase tudo casaria.
export function parseQuery(value: string): SearchQuery | null {
  const compact = compactOf(value);
  if (compact.length < MIN_QUERY_LENGTH) return null;
  return { tokens: tokensOf(value), compact };
}

// Casa quando toda palavra digitada é o começo de algum termo ("joao sil"
// acha "João da Silva"), ou quando o texto sem máscara é o começo de uma
// chave ("000.000.001" acha o CPF 00000000191).
export function matchesTerms(terms: string[], query: SearchQuery): boolean {
  const byWords =
    query.tokens.length > 0 &&
    query.tokens.every((token) => terms.some((term) => term.startsWith(token)));
  return byWords || terms.some((term) => term.startsWith(query.compact));
}

// Para montar a expressão regular no MongoDB sem que um "." digitado vire
// "qualquer caractere". Os termos só têm letras e dígitos, mas o cuidado é
// barato.
export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
