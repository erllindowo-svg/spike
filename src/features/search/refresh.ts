import "server-only";

import { getDb } from "@/db";

import { refreshSearchEntry, type Subject } from "./entries";

// Chamada depois de cada gravação que muda o que se sabe de um assunto
// (consulta, base própria, parte, monitoramento, apagar). A busca é
// derivada: se a atualização falhar, a gravação principal continua valendo,
// e a entrada se corrige na próxima gravação do mesmo assunto ou numa
// reconstrução. Por isso o erro só vai para o log.
export async function refreshSearchEntries(subjects: Subject[]): Promise<void> {
  const unique = new Map(
    subjects.map((s) => [`${s.searchType}:${s.searchKey}`, s]),
  );
  try {
    const db = await getDb();
    for (const subject of unique.values())
      await refreshSearchEntry(db, subject);
  } catch (error) {
    console.error(
      "[search] falha ao atualizar a busca:",
      error instanceof Error ? error.message : String(error),
    );
  }
}
