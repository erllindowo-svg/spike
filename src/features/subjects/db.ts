import "server-only";

import { getDb } from "@/db";
import { collections } from "@/db/collections";
import { deleteSubjectRecords, type Subject } from "@/features/base/db";
import { OPEN_QUERY_WINDOW_MS } from "@/features/queries/db";

// "Apagar este assunto" (círculo 3, fatia 6): tira do banco o que o app
// guardou sobre um identificador. Duas travas, porque o que está em
// andamento continua custando ou ainda vai chegar:
//
//   monitoramento não excluído   precisa ser excluído antes (cobrança
//                                recorrente; os alertas apontam para ele)
//   consulta assíncrona aberta   o resultado ainda vai chegar
//
// Apaga: a base própria do assunto (o que só ele encontrou), o histórico de
// consultas dele (síncronas e assíncronas) e a parte salva, se nenhum
// monitoramento (nem os excluídos, que ficam como histórico) aponta para
// ela.

export type DeleteSubjectResult =
  | { ok: true; removedRecords: number; removedQueries: number }
  | { ok: false; reason: "tracking" | "open_query" };

export async function deleteSubject(
  subject: Subject,
  now = new Date(),
): Promise<DeleteSubjectResult> {
  const db = collections(await getDb());

  // Nome e RJI não têm monitoramento; a consulta só não acha nada.
  const trackings = await db.trackings
    .find(subject as { searchType: never; searchKey: string })
    .toArray();
  if (trackings.some((t) => t.active)) {
    return { ok: false, reason: "tracking" };
  }
  const open = await db.juditRequests.countDocuments({
    ...subject,
    status: { $in: ["pending", "started"] },
    createdAt: { $gt: new Date(now.getTime() - OPEN_QUERY_WINDOW_MS) },
  });
  if (open > 0) return { ok: false, reason: "open_query" };

  const removedRecords = await deleteSubjectRecords(subject);
  const [sync, async] = await Promise.all([
    db.syncQueries.deleteMany(subject),
    db.juditRequests.deleteMany(subject),
  ]);

  if (
    (subject.searchType === "cpf" || subject.searchType === "cnpj") &&
    trackings.length === 0
  ) {
    await db.parties.deleteOne({
      documentType: subject.searchType,
      document: subject.searchKey,
    });
  }

  return {
    ok: true,
    removedRecords,
    removedQueries: sync.deletedCount + async.deletedCount,
  };
}
