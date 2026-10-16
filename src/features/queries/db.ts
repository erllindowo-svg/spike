import "server-only";

import { randomUUID } from "node:crypto";

import { getDb } from "@/db";
import { collections, toModel, type JuditRequestDoc } from "@/db/collections";
import type { JuditRequest, SyncQuery } from "@/db/models";

// Persistência dos ponteiros de consultas assíncronas (coleção
// `judit_requests`). Só o `request_id` e os dados para acompanhá-lo: os
// processos continuam sendo lidos da JUDIT.

function toJuditRequest(doc: JuditRequestDoc): JuditRequest {
  return {
    id: doc._id,
    requestId: doc.requestId,
    partyId: doc.partyId,
    mode: doc.mode,
    delivery: doc.delivery,
    searchType: doc.searchType,
    searchKey: doc.searchKey,
    cacheTtlInDays: doc.cacheTtlInDays,
    status: doc.status,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    lastCheckedAt: doc.lastCheckedAt,
  };
}

export type NewJuditRequest = Pick<
  JuditRequest,
  | "requestId"
  | "partyId"
  | "mode"
  | "delivery"
  | "searchType"
  | "searchKey"
  | "cacheTtlInDays"
  | "status"
>;

// Grava uma consulta que a JUDIT já aceitou. Um `request_id` repetido é
// recusado pelo índice único (o erro sobe para quem chamou).
export async function saveJuditRequest(
  input: NewJuditRequest,
): Promise<JuditRequest> {
  const { juditRequests } = collections(await getDb());
  const now = new Date();
  const doc: JuditRequestDoc = {
    _id: randomUUID(),
    ...input,
    createdAt: now,
    updatedAt: now,
    lastCheckedAt: null,
  };
  await juditRequests.insertOne(doc);
  return toJuditRequest(doc);
}

export async function listJuditRequests(
  partyId: string,
): Promise<JuditRequest[]> {
  const { juditRequests } = collections(await getDb());
  const docs = await juditRequests
    .find({ partyId })
    .sort({ createdAt: -1 })
    .toArray();
  return docs.map(toJuditRequest);
}

// Todas as empresas, para a página Consultas. Sem paginação: volume de
// protótipo.
export async function listRecentJuditRequests(
  limit = 200,
): Promise<JuditRequest[]> {
  const { juditRequests } = collections(await getDb());
  const docs = await juditRequests
    .find()
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
  return docs.map(toJuditRequest);
}

export async function getJuditRequest(
  requestId: string,
): Promise<JuditRequest | null> {
  const { juditRequests } = collections(await getDb());
  const doc = await juditRequests.findOne({ requestId });
  return doc ? toJuditRequest(doc) : null;
}

// Registra o status mais recente informado pela JUDIT.
export async function updateJuditRequestStatus(
  requestId: string,
  status: string,
): Promise<JuditRequest | null> {
  const { juditRequests } = collections(await getDb());
  const now = new Date();
  const doc = await juditRequests.findOneAndUpdate(
    { requestId },
    { $set: { status, lastCheckedAt: now, updatedAt: now } },
    { returnDocument: "after" },
  );
  return doc ? toJuditRequest(doc) : null;
}

// A JUDIT avisou pelo webhook que a consulta terminou (application_info,
// código 600). Grava o mesmo status que GET /requests/{id} devolveria, mas
// não mexe em `lastCheckedAt`: ninguém perguntou à JUDIT, foi ela que avisou.
export async function markJuditRequestCompleted(
  requestId: string,
): Promise<JuditRequest | null> {
  const { juditRequests } = collections(await getDb());
  const doc = await juditRequests.findOneAndUpdate(
    { requestId },
    { $set: { status: "completed", updatedAt: new Date() } },
    { returnDocument: "after" },
  );
  return doc ? toJuditRequest(doc) : null;
}

// Por quanto tempo uma consulta "pending" ou "started" impede outra igual.
// Escolha nossa: a JUDIT não documenta um status de falha (IK7), então uma
// consulta que nunca terminar bloquearia a empresa para sempre. Depois de
// 24 h, ela deixa de contar.
export const OPEN_QUERY_WINDOW_MS = 24 * 60 * 60 * 1000;

// Consulta ainda em aberto, segundo o NOSSO banco, para o mesmo alvo e a
// mesma modalidade. O alvo é a parte (consultas por documento) ou, numa
// consulta por processo, o CNJ. O status do banco só muda quando alguém
// pergunta à JUDIT ("Verificar status") ou quando o webhook avisa o fim
// (código 600).
export async function findOpenJuditRequest(
  target: { partyId: string | null; searchKey: string },
  mode: JuditRequest["mode"],
  now = new Date(),
): Promise<JuditRequest | null> {
  const { juditRequests } = collections(await getDb());
  const doc = await juditRequests.findOne(
    {
      ...(target.partyId
        ? { partyId: target.partyId }
        : { searchKey: target.searchKey }),
      mode,
      status: { $in: ["pending", "started"] },
      createdAt: { $gt: new Date(now.getTime() - OPEN_QUERY_WINDOW_MS) },
    },
    { sort: { createdAt: -1 } },
  );
  return doc ? toJuditRequest(doc) : null;
}

// Consultas síncronas (coleção `sync_queries`): só metadados de cada chamada
// que chegou à JUDIT. Ver o comentário de SyncQuery em src/db/models.ts.

export type NewSyncQuery = Omit<SyncQuery, "id" | "createdAt">;

export async function saveSyncQuery(input: NewSyncQuery): Promise<SyncQuery> {
  const { syncQueries } = collections(await getDb());
  const doc = { _id: randomUUID(), ...input, createdAt: new Date() };
  await syncQueries.insertOne(doc);
  return toModel(doc);
}

export async function listSyncQueries(limit = 200): Promise<SyncQuery[]> {
  const { syncQueries } = collections(await getDb());
  const docs = await syncQueries
    .find()
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
  return docs.map(toModel);
}
