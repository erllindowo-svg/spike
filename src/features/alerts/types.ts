import type { Alert } from "@/db/schema";

// Tipos usados em alerts.type. Valores próprios do produto, não da JUDIT.
export type AlertType = "new_lawsuit" | "lawsuit_movement" | "tracking_notice";

export type AlertView = Omit<Alert, "type"> & {
  type: AlertType;
  // Ainda não existe coluna para o processo relacionado; candidato ao schema.
  lawsuitCnj: string | null;
};

export const alertTypeLabels: Record<AlertType, string> = {
  new_lawsuit: "Novo processo",
  lawsuit_movement: "Movimentação",
  tracking_notice: "Monitoramento",
};
