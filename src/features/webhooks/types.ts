import type { WebhookEvent, WebhookProcessingStatus } from "@/db/models";

export type { WebhookProcessingStatus };

export type WebhookEventView = WebhookEvent & {
  // Reentregas com o mesmo callback_id descartadas pelo índice único.
  // Ainda não existe campo para isso; candidato ao modelo.
  duplicateDeliveries: number;
  alertIds: string[];
};

export const processingStatusLabels: Record<WebhookProcessingStatus, string> = {
  pending: "Recebido, não processado",
  processing: "Processando",
  processed: "Processado",
  failed: "Falha",
  ignored: "Ignorado",
};

export function getProcessingDurationMs(event: WebhookEvent): number | null {
  if (!event.processedAt) return null;
  return event.processedAt.getTime() - event.receivedAt.getTime();
}
