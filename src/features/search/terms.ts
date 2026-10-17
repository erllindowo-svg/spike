// Termos de busca (círculo 3B, opção B). Cada entrada da busca guarda as
// palavras pesquisáveis em minúsculas e sem acento (`terms`), num campo com
// índice comum do MongoDB. A busca acha as palavras que COMEÇAM com o que
// foi digitado ("erl" acha "Erllan"), como a barra do Google; o meio da
// palavra ("llan") não é achado. Funções puras: o banco
// (src/features/search/entries.ts) e a demonstração usam as mesmas.

export const MIN_QUERY_LENGTH = 3;

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

// Os termos de uma entrada: as palavras dos textos e as chaves inteiras,
// sem repetição.
export function buildTerms(
  texts: (string | null | undefined)[],
  keys: string[],
): string[] {
  const terms = new Set<string>();
  for (const text of texts)
    for (const token of tokensOf(text)) terms.add(token);
  for (const key of keys) {
    const compact = compactOf(key);
    if (compact) terms.add(compact);
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
