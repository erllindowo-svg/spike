"use server";

import { parseSearchKey } from "@/features/consult/identify";
import { getSubjectContext, type SubjectContext } from "@/lib/data";

import { isSearchType } from "./subjects";

// O "Já capturado" da página Consultar: o que os dados fictícios sabem de um
// identificador reconhecido. Null quando a chave não é válida.
export async function getSubjectContextAction(input: {
  searchType: string;
  searchKey: string;
}): Promise<SubjectContext | null> {
  const searchType = isSearchType(input.searchType) ? input.searchType : null;
  const searchKey = searchType
    ? parseSearchKey(searchType, input.searchKey)
    : null;
  if (!searchType || !searchKey) return null;
  return getSubjectContext(searchType, searchKey);
}
