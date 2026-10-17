import type { StatusTone } from "@/components/shared/status-badge";
import type { ResultDelivery, SyncQueryOutcome } from "@/db/models";

// Rótulos de status das consultas, usados pelo card da empresa e pela página
// Consultas.

type StatusLabel = { label: string; tone: StatusTone };

// Status documentados de uma request assíncrona (OpenAPI). Um status
// desconhecido aparece como veio da JUDIT.
const asyncStatusLabels: Record<string, StatusLabel> = {
  pending: { label: "Na fila", tone: "pending" },
  started: { label: "Em andamento", tone: "info" },
  cancelling: { label: "Cancelando", tone: "warning" },
  cancelled: { label: "Cancelada", tone: "neutral" },
  completed: { label: "Concluída", tone: "success" },
};

export function asyncStatusLabel(status: string): StatusLabel {
  return Object.hasOwn(asyncStatusLabels, status)
    ? asyncStatusLabels[status]
    : { label: status, tone: "warning" };
}

// Resultado de uma consulta síncrona, do nosso lado (models.ts).
export const syncOutcomeLabels: Record<SyncQueryOutcome, StatusLabel> = {
  ok: { label: "Concluída", tone: "success" },
  failed: { label: "Recusada pela JUDIT", tone: "danger" },
  uncertain: { label: "Sem resposta", tone: "warning" },
};

// Como o resultado de uma consulta assíncrona chega. Detalhe de transporte:
// só aparece na vista de suporte.
export const deliveryLabels: Record<ResultDelivery, string> = {
  polling: "entrega por polling",
  webhook: "entrega por webhook",
};
