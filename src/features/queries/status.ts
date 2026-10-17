import type { StatusTone } from "@/components/shared/status-badge";

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
