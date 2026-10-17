import type { Tracking, TrackingSearchType } from "@/db/models";

export type { Tracking, TrackingSearchType };

export type NewTrackingInput = Pick<Tracking, "searchType" | "searchKey"> & {
  partyId?: string | null;
  // Obrigatória e sem padrão: define com que frequência o monitoramento roda.
  recurrenceDays: number;
  // Só CNJ: avisar apenas movimentações com estes termos.
  stepTerms?: string[];
};

export const searchTypeLabels: Record<TrackingSearchType, string> = {
  cnpj: "CNPJ",
  cpf: "CPF",
  cnj: "CNJ",
  oab: "OAB",
};

export const searchTypeDescriptions: Record<TrackingSearchType, string> = {
  cnpj: "Descoberta de novos processos da empresa",
  cpf: "Descoberta de novos processos da pessoa",
  cnj: "Acompanhamento de processo",
  oab: "Descoberta de novos processos do advogado",
};

// Estados exibidos na interface. São deliberadamente independentes dos valores
// técnicos gravados em trackings.status (retornados pela JUDIT) e em
// trackings.creation (o nosso ciclo de criação).
export type TrackingDisplayState =
  | "not_sent"
  | "uncertain"
  | "rejected"
  | "pending_first_run"
  | "active"
  | "paused"
  | "completed"
  | "failed"
  | "unknown";

// Status documentados pela JUDIT (created, updating, updated, paused,
// deleted). "suspended" só aparece no OpenAPI, sem explicação.
const technicalToDisplay: Record<string, TrackingDisplayState> = {
  created: "pending_first_run",
  updating: "active",
  updated: "active",
  paused: "paused",
  deleted: "completed",
  suspended: "failed",
};

export function getTrackingDisplayState(
  tracking: Pick<Tracking, "status" | "creation">,
): TrackingDisplayState {
  switch (tracking.creation) {
    case "pending":
      return "not_sent";
    case "sending":
    case "uncertain":
      return "uncertain";
    case "failed":
      return "rejected";
  }
  if (!tracking.status) return "pending_first_run";
  return Object.hasOwn(technicalToDisplay, tracking.status)
    ? technicalToDisplay[tracking.status]
    : "unknown";
}

// Encerrado: excluído na JUDIT ou recusado na criação. Não conta como
// monitoramento existente (e libera o identificador).
export function isTrackingClosed(
  tracking: Pick<Tracking, "status" | "creation">,
): boolean {
  const state = getTrackingDisplayState(tracking);
  return state === "completed" || state === "rejected";
}

export const trackingDisplayLabels: Record<TrackingDisplayState, string> = {
  not_sent: "Não enviado à JUDIT",
  uncertain: "Envio incerto",
  rejected: "Recusado pela JUDIT",
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
