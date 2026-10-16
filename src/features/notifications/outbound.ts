import "server-only";

import type { Alert } from "@/db/models";

// Evento de saída: o ponto em que o app avisaria um sistema de fora (e-mail,
// Slack, o sistema do cliente) que algo aconteceu. Por decisão do usuário
// (círculo 1 do escopo, C1-11), ele existe sem destino: é o "macho da
// tomada" sem uma "fêmea". Mostra onde a integração se encaixaria, sem
// enviar nada.
//
// Se um dia houver destino, o envio entra em publishAlertCreated, e a
// pergunta passa a ser a mesma que fizemos com os webhooks da JUDIT, agora do
// outro lado: o que fazer se o destino estiver fora do ar, repetir, e como o
// destino reconhece um evento repetido (o `eventId`).
//
// O evento leva o mínimo: tipo e identificadores. Nada do processo (CNJ,
// título, descrição): quem recebe consulta o app para saber mais. Assim, um
// destino mal configurado não vaza dados processuais.

export type AlertCreatedEvent = {
  type: "alert.created";
  // Igual ao id do alerta: um alerta gera um evento só, e o destino pode
  // usar este valor para descartar repetições (idempotência).
  eventId: string;
  alertId: string;
  alertType: string;
  trackingId: string | null;
  companyId: string | null;
  occurredAt: string;
};

export function buildAlertCreatedEvent(alert: Alert): AlertCreatedEvent {
  return {
    type: "alert.created",
    eventId: alert.id,
    alertId: alert.id,
    alertType: alert.type,
    trackingId: alert.trackingId,
    companyId: alert.companyId,
    occurredAt: alert.createdAt.toISOString(),
  };
}

export type OutboundResult =
  | { delivered: true; event: AlertCreatedEvent }
  | { delivered: false; reason: "no_destination"; event: AlertCreatedEvent };

// Sem destino configurado: o evento só é registrado no log do servidor.
export function publishAlertCreated(alert: Alert): OutboundResult {
  const event = buildAlertCreatedEvent(alert);
  console.info(
    `[outbound] ${event.type} ${event.eventId} (${event.alertType}): sem destino configurado; nada foi enviado.`,
  );
  return { delivered: false, reason: "no_destination", event };
}
