import "server-only";

import { randomUUID } from "node:crypto";

import { getDb } from "@/db";
import { collections, type JuditRequestDoc } from "@/db/collections";
import type { JuditRequest } from "@/db/models";

// Persistência dos ponteiros de consultas assíncronas (coleção
// `judit_requests`). Só o `request_id` e os dados para acompanhá-lo: os
// processos continuam sendo lidos da JUDIT.

function toJuditRequest(doc: JuditRequestDoc): JuditRequest {
  return {
    id: doc._id,
    requestId: doc.requestId,
    companyId: doc.companyId,
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
  | "companyId"
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
  companyId: string,
): Promise<JuditRequest[]> {
  const { juditRequests } = collections(await getDb());
  const docs = await juditRequests
    .find({ companyId })
    .sort({ createdAt: -1 })
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
