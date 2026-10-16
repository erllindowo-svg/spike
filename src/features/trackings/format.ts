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

// `hour_range` da JUDIT. A documentação não diz o fuso; a execução observada
// em 2026-10-15 (hour_range 6, rodou às 06:55 UTC) indica UTC (IK5, catálogo
// C14). Mostramos os dois, para não afirmar o que não está documentado.
export function formatHourRange(hour: number): string {
  const brasilia = (hour + 21) % 24;
  return `${hour}h UTC (${brasilia}h em Brasília)`;
}
