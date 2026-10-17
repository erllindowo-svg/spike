import type { SearchType } from "@/lib/models";
import { displaySearchKey } from "@/features/consult/identify";
import type { WebhookEventView } from "@/features/webhooks/types";

// Como o identificador aparece em listas: CNPJ e CNJ inteiros, CPF mascarado
// (dado pessoal; escolha R6 do escopo). Vale para todos os tipos de busca.
export function formatSearchKey(type: SearchType, key: string): string {
  return displaySearchKey(type, key);
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
