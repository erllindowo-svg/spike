import type { NewTracking, Tracking } from "@/db/schema";

export type { Tracking };

export type TrackingSearchType = Tracking["searchType"];

export type NewTrackingInput = Pick<
  NewTracking,
  "searchType" | "searchKey" | "companyId" | "recurrenceDays"
>;

export const searchTypeLabels: Record<TrackingSearchType, string> = {
  cnpj: "CNPJ",
  cnj: "CNJ",
};

export const searchTypeDescriptions: Record<TrackingSearchType, string> = {
  cnpj: "Descoberta de novos processos",
  cnj: "Acompanhamento de processo",
};

// Estados exibidos na interface. São deliberadamente independentes dos valores
// técnicos gravados em trackings.status (retornados pela JUDIT).
export type TrackingDisplayState =
  | "pending_first_run"
  | "active"
  | "paused"
  | "completed"
  | "failed"
  | "unknown";

// Mapeamento provisório a partir dos status documentados pela JUDIT
// (created, updating, updated, paused, deleted, suspended). Revisar na
// etapa de integração.
const technicalToDisplay: Record<string, TrackingDisplayState> = {
  created: "pending_first_run",
  updating: "active",
  updated: "active",
  paused: "paused",
  deleted: "completed",
  suspended: "failed",
};

export function getTrackingDisplayState(
  status: string | null,
): TrackingDisplayState {
  if (!status) return "pending_first_run";
  return technicalToDisplay[status] ?? "unknown";
}

export const trackingDisplayLabels: Record<TrackingDisplayState, string> = {
  pending_first_run: "Aguardando primeira execução",
  active: "Ativo",
  paused: "Pausado",
  completed: "Encerrado",
  failed: "Falha",
  unknown: "Status desconhecido",
};

export const recurrenceOptions = [1, 7, 15, 30] as const;

export function formatRecurrence(days: number | null): string {
  if (!days) return "Não definida";
  if (days === 1) return "Diária";
  if (days === 7) return "Semanal";
  return `A cada ${days} dias`;
}
