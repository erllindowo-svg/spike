import "server-only";

import type { RecordSource } from "@/db/models";
import { getJuditRequest } from "@/features/queries/db";
import { getTrackingByJuditId } from "@/features/trackings/db";

import { saveBatch, type SaveSummary, type Subject } from "./db";
import { batchFromResponses } from "./records";

type ResponseItem = {
  response_type?: string;
  response_data?: unknown;
  created_at?: string;
};

// Itens de GET /responses (consulta ou monitoramento). Cada item tem a sua
// data (`created_at`): ela decide a atualização, para que uma página relida
// depois não passe por cima de uma entrega mais nova.
export async function saveResponsesToBase(
  subject: Subject,
  source: RecordSource,
  items: ResponseItem[],
): Promise<SaveSummary> {
  const total: SaveSummary = { saved: 0, kept: 0 };
  for (const item of items) {
    const batch = batchFromResponses([item], subject);
    if (batch.records.length === 0 && !batch.aiSummary) continue;
    const result = await saveBatch(subject, source, batch, dateOf(item));
    total.saved += result.saved;
    total.kept += result.kept;
  }
  return total;
}

function dateOf(item: ResponseItem): Date {
  const parsed = item.created_at ? new Date(item.created_at) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed : new Date();
}

// Uma entrega de webhook, com o corpo inteiro (o evento gravado em
// webhook_events guarda só um resumo do processo, por redução de dados). O
// assunto vem da consulta ou do monitoramento do app; uma referência
// desconhecida não grava nada.
export async function saveDeliveryToBase(envelope: {
  reference_type?: string;
  reference_id?: string;
  payload?: ResponseItem;
}): Promise<SaveSummary | null> {
  const { reference_type: type, reference_id: id, payload } = envelope;
  if (!id || !payload) return null;

  if (type === "request") {
    const request = await getJuditRequest(id);
    if (!request) return null;
    return saveResponsesToBase(
      { searchType: request.searchType, searchKey: request.searchKey },
      { origin: "webhook", mode: request.mode, reference: id },
      [payload],
    );
  }
  if (type === "tracking") {
    const tracking = await getTrackingByJuditId(id);
    if (!tracking) return null;
    return saveResponsesToBase(
      { searchType: tracking.searchType, searchKey: tracking.searchKey },
      { origin: "webhook", mode: tracking.mode, reference: id },
      [payload],
    );
  }
  return null;
}
