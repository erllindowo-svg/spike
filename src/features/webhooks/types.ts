import type { WebhookEvent } from "@/db/schema";

export type WebhookProcessingStatus = WebhookEvent["processingStatus"];

export type WebhookEventView = WebhookEvent & {
  // Reentregas com o mesmo callback_id descartadas pela restrição UNIQUE.
  // Ainda não existe coluna para isso; candidato ao schema.
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
