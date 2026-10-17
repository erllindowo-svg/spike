import type { Alert } from "@/lib/models";

// Tipos usados em alerts.type. Valores próprios do produto, não da JUDIT.
export type AlertType = "new_lawsuit" | "lawsuit_movement" | "tracking_notice";

export type AlertView = Omit<Alert, "type"> & { type: AlertType };

export const alertTypeLabels: Record<AlertType, string> = {
  new_lawsuit: "Novo processo",
  lawsuit_movement: "Movimentação",
  tracking_notice: "Monitoramento",
};
