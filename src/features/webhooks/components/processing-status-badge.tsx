import { StatusBadge, type StatusTone } from "@/components/shared/status-badge";
import {
  processingStatusLabels,
  type WebhookProcessingStatus,
} from "@/features/webhooks/types";

const tones: Record<WebhookProcessingStatus, StatusTone> = {
  pending: "warning",
  processing: "info",
  processed: "success",
  failed: "danger",
  ignored: "neutral",
};

export function ProcessingStatusBadge({
  status,
}: {
  status: WebhookProcessingStatus;
}) {
  return (
    <StatusBadge tone={tones[status]}>
      {processingStatusLabels[status]}
    </StatusBadge>
  );
}
