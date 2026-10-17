import type { WebhookEvent, WebhookProcessingStatus } from "@/lib/models";

export type { WebhookProcessingStatus };

export type WebhookEventView = WebhookEvent & {
  // Alertas cujo `webhookEventId` é este evento. Um evento processado pode
  // não ter alerta (consulta, ou alerta já criado por outra entrega).
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
