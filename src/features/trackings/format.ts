import { formatCnpj } from "@/features/companies/cnpj";
import { formatCnj } from "@/features/processes/cnj";
import type { WebhookEventView } from "@/features/webhooks/types";

import type { TrackingSearchType } from "./types";

export function formatSearchKey(type: TrackingSearchType, key: string): string {
  return type === "cnpj" ? formatCnpj(key) : formatCnj(key);
}

// Último evento recebido por reference_id (tracking_id da JUDIT).
export function getLastEventByReference(
  events: WebhookEventView[],
): Map<string, Date> {
  const map = new Map<string, Date>();
  for (const event of events) {
    if (!event.referenceId) continue;
    const current = map.get(event.referenceId);
    if (!current || event.receivedAt > current) {
      map.set(event.referenceId, event.receivedAt);
    }
  }
  return map;
}
