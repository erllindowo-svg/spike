import "server-only";

import type { Tracking, WebhookEvent } from "@/db/models";
import {
  createAlert,
  type CreatedAlert,
  type NewAlert,
} from "@/features/alerts/db";
import { displayDocument } from "@/features/parties/documents";
import { publishAlertCreated } from "@/features/notifications/outbound";
import { formatCnj } from "@/features/processes/cnj";
import {
  getJuditRequest,
  markJuditRequestCompleted,
} from "@/features/queries/db";
import {
  getTrackingByJuditId,
  markTrackingPausedByJudit,
} from "@/features/trackings/db";

import {
  claimWebhookEvent,
  finishWebhookEvent,
  listUnprocessedEventIds,
  type ProcessingOutcome,
} from "./db";
import {
  readDelivery,
  TRACKING_PAUSE_REASONS,
  type Delivery,
} from "./delivery";

// Processamento de uma entrega já gravada (etapa 6). Roda depois do 200
// (after() na rota) ou pelo botão "Reprocessar" da tela /webhooks.
//
//   claimWebhookEvent   pending → processing (atômico: um processamento só)
//   regras abaixo       associa à consulta ou ao monitoramento do app,
//                       atualiza o estado e cria o alerta, se a regra pedir
//   finishWebhookEvent  processed | ignored | failed, com a nota ou o erro
//
// As regras são decisões do app, não da documentação
// (docs/plano-etapas-6-7.md). O `dedupeKey` de cada alerta segue a mesma
// tabela: por processo no monitoramento por documento, por entrega nos
// demais.
//
//   Consulta (reference_type "request"), nunca gera alerta: foi a pessoa que
//   pediu, e o card da empresa mostra o resultado.
//     600                 consulta "completed" (substitui a pergunta à JUDIT)
//     application_error   só registrado; o status da consulta não muda (IK7)
//     processo e outros   só registrados
//
//   Monitoramento (reference_type "tracking"):
//     processo, por documento   alerta "new_lawsuit", um por processo
//     processo, por CNJ         alerta "lawsuit_movement", um por entrega
//     700 a 703                 monitoramento "paused" + alerta "tracking_notice"
//     application_error         alerta "tracking_notice"
//
//   Referência que o app não conhece: "ignored". Pode ser reprocessado
//   depois, se a referência for gravada mais tarde.
//
// Cada alerta novo também publica o evento de saída `alert.created`
// (src/features/notifications/outbound.ts), hoje sem destino: só vai para o
// log.

export type ProcessResult = ProcessingOutcome | { status: "skipped" };

export async function processWebhookEvent(
  eventId: string,
): Promise<ProcessResult> {
  const event = await claimWebhookEvent(eventId);
  // Já processado, ou outro processamento em andamento.
  if (!event) return { status: "skipped" };

  let outcome: ProcessingOutcome;
  try {
    outcome = await applyRules(event);
  } catch (error) {
    // Falha de banco no meio das regras. As regras podem ser repetidas sem
    // efeito duplicado (status fixo e alerta com dedupeKey), então
    // "Reprocessar" é seguro.
    outcome = {
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
    };
  }

  // Se esta gravação também falhar, o erro sobe e o evento fica preso em
  // "processing"; depois de STALE_PROCESSING_MS ele volta a ser
  // reprocessável.
  await finishWebhookEvent(event.id, outcome);
  console.info(
    `[webhooks] ${outcome.status}: callback_id=${event.callbackId ?? "(ausente)"} ` +
      `${event.referenceType ?? "?"}=${event.referenceId ?? "?"} → ` +
      (outcome.status === "failed" ? outcome.error : outcome.note),
  );
  return outcome;
}

// Entregas que chegaram ANTES de o app gravar a referência: a JUDIT pode
// entregar o primeiro evento enquanto o insert em judit_requests ainda não
// terminou, e ele fica "ignored". Chamada logo depois de gravar a consulta.
// Um evento que esteja no meio do processamento nesse instante é pulado e
// pode terminar "ignored"; "Reprocessar" em /webhooks resolve.
export async function processEventsForReference(
  referenceId: string,
): Promise<ProcessResult[]> {
  const results: ProcessResult[] = [];
  for (const id of await listUnprocessedEventIds(referenceId)) {
    results.push(await processWebhookEvent(id));
  }
  return results;
}

async function applyRules(event: WebhookEvent): Promise<ProcessingOutcome> {
  const delivery = readDelivery(event.payload);
  if (!event.referenceId) {
    return ignored("Entrega sem reference_id: não há o que associar.");
  }
  if (event.referenceType === "request") {
    return processRequestEvent(event.referenceId, delivery);
  }
  if (event.referenceType === "tracking") {
    return processTrackingEvent(event, event.referenceId, delivery);
  }
  return ignored(
    `reference_type não tratado: ${event.referenceType ?? "(ausente)"}.`,
  );
}

async function processRequestEvent(
  requestId: string,
  delivery: Delivery,
): Promise<ProcessingOutcome> {
  const request = await getJuditRequest(requestId);
  if (!request) {
    return ignored("Consulta não encontrada nesta aplicação (judit_requests).");
  }

  switch (delivery.kind) {
    case "request_completed":
      await markJuditRequestCompleted(requestId);
      return processed("Consulta marcada como concluída (código 600).");
    case "application_error":
      return processed(
        `Erro informado pela JUDIT (${describeError(delivery)}). ` +
          "O status da consulta não foi alterado.",
      );
    case "lawsuit":
      return processed("Processo recebido da consulta; sem alerta.");
    case "tracking_paused":
    case "other_info":
      return ignored(
        `Aviso application_info não esperado numa consulta (código ${delivery.code}).`,
      );
    case "other":
      return processed(
        `Resposta "${delivery.responseType ?? "?"}" recebida da consulta; sem alerta.`,
      );
  }
}

async function processTrackingEvent(
  event: WebhookEvent,
  juditTrackingId: string,
  delivery: Delivery,
): Promise<ProcessingOutcome> {
  const tracking = await getTrackingByJuditId(juditTrackingId);
  if (!tracking) {
    return ignored("Monitoramento não encontrado nesta aplicação (trackings).");
  }

  switch (delivery.kind) {
    case "lawsuit":
      return tracking.mode === "tracking_document"
        ? alertNewLawsuit(event, tracking, delivery.cnj)
        : alertMovement(event, tracking, delivery.cnj);

    case "tracking_paused": {
      await markTrackingPausedByJudit(tracking.id);
      const reason = TRACKING_PAUSE_REASONS[delivery.code];
      const alert = await raiseAlert({
        ...alertBase(event, tracking, null),
        type: "tracking_notice",
        dedupeKey: perEventKey("tracking_notice", event),
        title: "Monitoramento pausado pela JUDIT",
        description:
          `O ${trackingLabel(tracking)} foi pausado: ${reason} ` +
          `(código ${delivery.code}). Depois de regularizar, use "Reativar".`,
      });
      return processed(
        `Monitoramento marcado como pausado (código ${delivery.code}). ${alertNote(alert.created)}`,
      );
    }

    case "application_error": {
      const alert = await raiseAlert({
        ...alertBase(event, tracking, null),
        type: "tracking_notice",
        dedupeKey: perEventKey("tracking_notice", event),
        title: "Erro informado pela JUDIT no monitoramento",
        description: `A JUDIT informou um erro no ${trackingLabel(tracking)}: ${describeError(delivery)}.`,
      });
      return processed(
        `Erro informado pela JUDIT (${describeError(delivery)}). ${alertNote(alert.created)}`,
      );
    }

    case "request_completed":
      // Não documentado para monitoramentos; se chegar, não pede ação.
      return processed("Aviso de fim de fluxo (código 600); sem alerta.");

    case "other_info":
      return ignored(
        `Aviso application_info com código não tratado: ${delivery.code ?? "(ausente)"}.`,
      );

    case "other":
      return ignored(
        `Resposta "${delivery.responseType ?? "?"}" não tratada para monitoramento.`,
      );
  }
}

// Monitoramento por documento: a JUDIT avisa cada processo novo
// distribuído para o documento. O mesmo processo pode chegar mais de uma vez
// (versão do cache e versão atualizada), mas é um fato só: um alerta por
// monitoramento e processo.
async function alertNewLawsuit(
  event: WebhookEvent,
  tracking: Tracking,
  cnj: string | null,
): Promise<ProcessingOutcome> {
  const alert = await raiseAlert({
    ...alertBase(event, tracking, cnj),
    type: "new_lawsuit",
    dedupeKey: cnj
      ? `new_lawsuit:${tracking.id}:${cnj}`
      : perEventKey("new_lawsuit", event),
    title: "Novo processo encontrado pelo monitoramento",
    description: `${cnj ? `Processo ${formatCnj(cnj)}` : "Processo sem número na entrega"}, encontrado pelo ${trackingLabel(tracking)}.`,
  });
  return processed(
    alert.created
      ? "Alerta de novo processo criado."
      : "Alerta deste processo já existia (entrega repetida ou versão atualizada).",
  );
}

// Monitoramento por CNJ: a JUDIT envia o processo inteiro a cada
// movimentação. Cada entrega é um fato novo: um alerta por entrega.
// Hipótese não verificada: se uma execução mandar a versão do cache e a
// atualizada, saem dois alertas. Nenhuma entrega de monitoramento por CNJ
// foi observada ainda (IK6).
async function alertMovement(
  event: WebhookEvent,
  tracking: Tracking,
  cnj: string | null,
): Promise<ProcessingOutcome> {
  const lawsuitCnj = cnj ?? tracking.searchKey;
  const alert = await raiseAlert({
    ...alertBase(event, tracking, lawsuitCnj),
    type: "lawsuit_movement",
    dedupeKey: perEventKey("lawsuit_movement", event),
    title: "Nova movimentação no processo monitorado",
    description: `Processo ${formatCnj(lawsuitCnj)}: a JUDIT enviou a versão atualizada.`,
  });
  return processed(
    alert.created
      ? "Alerta de movimentação criado."
      : "Alerta desta entrega já existia (evento reprocessado).",
  );
}

// Grava o alerta e, se ele é novo, publica o evento de saída
// (src/features/notifications/outbound.ts). Um alerta recusado pelo
// dedupeKey já foi publicado quando nasceu: não sai de novo.
async function raiseAlert(input: NewAlert): Promise<CreatedAlert> {
  const result = await createAlert(input);
  if (result.created) publishAlertCreated(result.alert);
  return result;
}

// Chave de um alerta que vale por entrega. Usa o `id` do nosso evento, que
// não muda ao reprocessar.
function perEventKey(type: NewAlert["type"], event: WebhookEvent): string {
  return `${type}:event:${event.id}`;
}

function alertBase(
  event: WebhookEvent,
  tracking: Tracking,
  lawsuitCnj: string | null,
) {
  return {
    partyId: tracking.partyId,
    webhookEventId: event.id,
    trackingId: tracking.id,
    lawsuitCnj,
  };
}

// Vai para o texto do alerta, gravado no banco: o CPF entra mascarado.
function trackingLabel(tracking: Tracking): string {
  return tracking.searchType === "cnj"
    ? `monitoramento do processo ${formatCnj(tracking.searchKey)}`
    : `monitoramento do ${tracking.searchType.toUpperCase()} ${displayDocument(tracking.searchType, tracking.searchKey)}`;
}

function describeError(
  delivery: Extract<Delivery, { kind: "application_error" }>,
): string {
  return (
    [delivery.code, delivery.message].filter(Boolean).join(": ") || "sem código"
  );
}

function alertNote(created: boolean): string {
  return created ? "Alerta criado." : "Alerta já existia.";
}

function processed(note: string): ProcessingOutcome {
  return { status: "processed", note };
}

function ignored(note: string): ProcessingOutcome {
  return { status: "ignored", note };
}
