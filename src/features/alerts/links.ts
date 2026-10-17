import type { Tracking } from "@/db/models";
import { subjectHref } from "@/features/subjects/subjects";

import type { AlertView } from "./types";

// Ligações de um alerta com as telas (círculo 7). Funções puras.

type AlertLink = Pick<AlertView, "trackingId" | "lawsuitCnj">;

// Para onde um alerta do menu do sino leva: a ficha do assunto do
// monitoramento e, se o alerta tem processo, o processo aberto
// (?processo=, lido em subject-page.tsx). Sem o monitoramento, o Acervo.
export function alertHref(
  alert: AlertLink,
  trackings: Pick<Tracking, "id" | "searchType" | "searchKey">[],
): string {
  const tracking = trackings.find((t) => t.id === alert.trackingId);
  if (!tracking) return "/acervo";
  const base = subjectHref(tracking.searchType, tracking.searchKey);
  return alert.lawsuitCnj ? `${base}?processo=${alert.lawsuitCnj}` : base;
}

// Os alertas não lidos dos monitoramentos de um assunto, por processo: a
// marca azul na lista de processos da ficha. Abrir o processo marca como
// lidos todos os ids da lista dele.
export function unreadAlertsByCnj(
  alerts: (AlertLink & Pick<AlertView, "id" | "readAt">)[],
  trackingIds: ReadonlySet<string>,
): Map<string, string[]> {
  const byCnj = new Map<string, string[]>();
  for (const a of alerts) {
    if (a.readAt || !a.lawsuitCnj) continue;
    if (!a.trackingId || !trackingIds.has(a.trackingId)) continue;
    byCnj.set(a.lawsuitCnj, [...(byCnj.get(a.lawsuitCnj) ?? []), a.id]);
  }
  return byCnj;
}
