import { DEMO_NOW } from "@/lib/mock-data";

import type { WebhookEventView } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

// Usa a data de referência dos mocks (ou o evento mais novo) para que a
// contagem seja estável entre renderização no servidor e no navegador.
export function getRecentEvents(
  events: WebhookEventView[],
  days: number,
): WebhookEventView[] {
  const reference = Math.max(
    DEMO_NOW.getTime(),
    ...events.map((e) => e.receivedAt.getTime()),
  );
  return events.filter(
    (e) => reference - e.receivedAt.getTime() <= days * DAY_MS,
  );
}

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
