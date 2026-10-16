import { displayDocument } from "@/features/parties/documents";
import { formatCnj } from "@/features/processes/cnj";
import type { WebhookEventView } from "@/features/webhooks/types";

import type { TrackingSearchType } from "./types";

// Como o identificador aparece em listas: CNPJ e CNJ inteiros, CPF mascarado
// (dado pessoal; escolha R6 do escopo).
export function formatSearchKey(type: TrackingSearchType, key: string): string {
  return type === "cnj" ? formatCnj(key) : displayDocument(type, key);
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
