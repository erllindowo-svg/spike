import type { WebhookEventView } from "./types";

export function countByStatus(events: WebhookEventView[]) {
  const counts = {
    pending: 0,
    processing: 0,
    processed: 0,
    failed: 0,
    ignored: 0,
  };
  for (const event of events) counts[event.processingStatus] += 1;
  return counts;
}
