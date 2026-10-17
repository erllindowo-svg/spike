"use server";

import { refresh } from "next/cache";

import { parseSearchKey } from "@/features/consult/identify";
import { getDataSource } from "@/lib/data";

import { deleteSubject } from "./db";
import { isSearchType } from "./subjects";

export type DeleteSubjectActionResult =
  { ok: true; message: string } | { ok: false; message: string };

const refusals = {
  tracking:
    "Este assunto tem um monitoramento. Exclua o monitoramento antes: ele é cobrado a cada execução.",
  open_query:
    "Há uma consulta assíncrona em andamento. Espere a conclusão (ou use “Verificar status”) antes de apagar.",
};

// Nada aqui confia no navegador: o tipo e a chave são validados de novo
// pela mesma regra da página Consultar.
export async function deleteSubjectAction(input: {
  searchType: string;
  searchKey: string;
}): Promise<DeleteSubjectActionResult> {
  if (getDataSource() !== "db") {
    return {
      ok: false,
      message: "Na demonstração, os dados fictícios não são apagados.",
    };
  }
  const searchType = isSearchType(input.searchType) ? input.searchType : null;
  const searchKey = searchType
    ? parseSearchKey(searchType, input.searchKey)
    : null;
  if (!searchType || !searchKey) {
    return { ok: false, message: "Identificador inválido." };
  }

  try {
    const result = await deleteSubject({ searchType, searchKey });
    if (!result.ok) return { ok: false, message: refusals[result.reason] };
    refresh();
    return {
      ok: true,
      message: `Apagados: ${result.removedRecords} registro(s) da base e ${result.removedQueries} consulta(s) do histórico.`,
    };
  } catch (error) {
    console.error(
      "[subjects] falha ao apagar assunto:",
      error instanceof Error ? error.message : String(error),
    );
    return {
      ok: false,
      message: "O banco não respondeu. Nada foi confirmado; tente de novo.",
    };
  }
}
