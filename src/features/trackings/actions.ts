"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import type { Tracking } from "@/db/models";
import { getCompanyByCnpj } from "@/features/companies/db";
import {
  juditActionFailure,
  type JuditActionFailure,
} from "@/features/queries/failure";
import {
  summarizeResponses,
  type ResponsesSummary,
} from "@/features/queries/responses";
import { getDataSource } from "@/lib/data";
import {
  JuditApplicationError,
  JuditGuardError,
  JuditHttpError,
  JuditLiveCallsDisabledError,
} from "@/lib/judit/errors";
import { listTrackingResponses } from "@/lib/judit/requests";
import {
  createTracking as createJuditTracking,
  deleteTracking as deleteJuditTracking,
  getTracking as getJuditTracking,
  pauseTracking as pauseJuditTracking,
  resumeTracking as resumeJuditTracking,
} from "@/lib/judit/tracking";
import type { Tracking as JuditTracking } from "@/lib/judit/schemas/tracking";

import {
  applyRemoteTracking,
  claimReservation,
  confirmReservation,
  createTracking,
  discardReservation,
  failReservation,
  getTracking,
  markReservationUncertain,
  releaseReservation,
  type CreateTrackingResult,
  type NewTrackingRequest,
} from "./db";

// Server Actions de monitoramento. O navegador chama estas funções, mas elas
// rodam no servidor. Por baixo, cada uma é um POST que qualquer pessoa pode
// enviar sem passar pela interface, por isso nenhuma confia no cliente.
//
// Um monitoramento confirmado roda NA JUDIT, a cada N dias, até ser pausado
// ou excluído. Desligar JUDIT_LIVE_CALLS não o interrompe: só impede o nosso
// servidor de fazer chamadas.
//
// Ainda não há autenticação: no modo "db", quem alcança a aplicação pode
// criar e excluir monitoramentos. A aplicação não deve ficar pública.

type Unavailable = {
  ok: false;
  reason: "unavailable" | "invalid";
  message: string;
};

function unavailable(): Unavailable {
  return {
    ok: false,
    reason: "unavailable",
    message: "Monitoramentos reais só funcionam no modo banco de dados.",
  };
}

// --- Criação: reserva no banco + envio à JUDIT ----------------------------

// Resultado do envio de uma reserva. Em todos os casos o monitoramento
// devolvido reflete o que ficou gravado.
export type SendOutcome =
  | "confirmed" // a JUDIT criou
  | "not_sent" // nada saiu do servidor; a reserva continua pendente
  | "failed" // a JUDIT recusou
  | "uncertain"; // sem resposta clara: pode existir na JUDIT

export type CreateTrackingActionResult =
  | (Extract<CreateTrackingResult, { ok: true }> & {
      outcome: SendOutcome;
      message: string;
    })
  | Exclude<CreateTrackingResult, { ok: true }>
  | { ok: false; reason: "unavailable" | "error" };

export async function createTrackingAction(
  input: NewTrackingRequest,
): Promise<CreateTrackingActionResult> {
  // No modo de demonstração, nada pode ser gravado no banco.
  if (getDataSource() !== "db") return { ok: false, reason: "unavailable" };

  try {
    // Passo 1: a reserva. O índice único recusa duplicatas aqui, antes de
    // qualquer chamada cobrada.
    const reserved = await createTracking(input);
    if (!reserved.ok) return reserved;

    // Passo 2: o envio.
    const sent = await sendReservation(reserved.tracking.id);
    // Recarrega os dados do servidor no navegador (por exemplo, a empresa
    // criada junto com um monitoramento de CNPJ).
    refresh();
    return {
      ok: true,
      tracking: sent?.tracking ?? reserved.tracking,
      outcome: sent?.outcome ?? "not_sent",
      message: sent?.message ?? "A reserva não pôde ser enviada agora.",
    };
  } catch (error) {
    // A mensagem do driver pode conter o endereço do banco: fica só no log
    // do servidor. O identificador monitorado não é registrado.
    console.error(
      "[trackings] falha ao gravar monitoramento:",
      error instanceof Error ? error.message : error,
    );
    return { ok: false, reason: "error" };
  }
}

export type TrackingActionResult =
  | { ok: true; tracking: Tracking; message: string }
  | Unavailable
  | JuditActionFailure;

// Envia uma reserva pendente: a da etapa 2 ou uma que não saiu porque as
// chamadas reais estavam desligadas.
export async function sendTrackingAction(
  id: string,
): Promise<TrackingActionResult> {
  if (getDataSource() !== "db") return unavailable();
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return invalid("Identificador inválido.");

  try {
    const sent = await sendReservation(parsedId.data);
    if (!sent) {
      return invalid("Não há reserva pendente com este identificador.");
    }
    refresh();
    return { ok: true, tracking: sent.tracking, message: sent.message };
  } catch (error) {
    return juditActionFailure(error, "trackings");
  }
}

// Descarta uma reserva que nunca foi enviada. Não chama a JUDIT.
export async function discardTrackingAction(
  id: string,
): Promise<{ ok: true } | Unavailable> {
  if (getDataSource() !== "db") return unavailable();
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return invalid("Identificador inválido.");

  if (!(await discardReservation(parsedId.data))) {
    return invalid("Só reservas ainda não enviadas podem ser descartadas.");
  }
  refresh();
  return { ok: true };
}

// Reivindica a reserva, chama POST /tracking e grava o resultado. Devolve
// null se a reserva não estava pendente (por exemplo, outro clique já a
// enviou).
async function sendReservation(id: string): Promise<{
  tracking: Tracking;
  outcome: SendOutcome;
  message: string;
} | null> {
  const claimed = await claimReservation(id);
  if (!claimed) return null;

  try {
    const remote = await createJuditTracking({
      searchType: claimed.searchType === "cnpj" ? "cnpj" : "lawsuit_cnj",
      searchKey: claimed.searchKey,
      recurrence: claimed.recurrenceDays ?? 30,
    });
    // O tracking_id não é segredo e é a única forma de achar o monitoramento
    // na JUDIT se a gravação abaixo falhar; por isso vai para o log antes.
    console.info(
      `[trackings] monitoramento criado na JUDIT: tracking_id ${remote.tracking_id}`,
    );
    const tracking = await confirmReservation(
      id,
      remote.tracking_id,
      remoteFields(remote),
    );
    return {
      tracking: tracking ?? claimed,
      outcome: "confirmed",
      message:
        remote.hour_range !== undefined
          ? `Criado na JUDIT. Primeira execução prevista para as ${remote.hour_range}h, em até 24 horas.`
          : "Criado na JUDIT. A primeira execução acontece em até 24 horas.",
    };
  } catch (error) {
    const { outcome, reason } = classifySendError(error);
    console.error(`[trackings] envio ${outcome}: ${reason}`);
    const tracking =
      outcome === "not_sent"
        ? await releaseReservation(id, reason)
        : outcome === "failed"
          ? await failReservation(id, reason)
          : await markReservationUncertain(id, reason);
    return { tracking: tracking ?? claimed, outcome, message: reason };
  }
}

// Decide o que um erro significa para a reserva. A pergunta é: "a JUDIT
// pode ter criado o monitoramento?"
function classifySendError(error: unknown): {
  outcome: Exclude<SendOutcome, "confirmed">;
  reason: string;
} {
  // Barrado antes de sair do servidor: com certeza nada foi criado.
  if (error instanceof JuditLiveCallsDisabledError) {
    return {
      outcome: "not_sent",
      reason:
        "Chamadas reais desligadas (JUDIT_LIVE_CALLS). A reserva continua pendente.",
    };
  }
  if (error instanceof JuditGuardError) {
    return {
      outcome: "not_sent",
      reason:
        "Identificador fora da allowlist de desenvolvimento. A reserva continua pendente.",
    };
  }
  // A JUDIT respondeu recusando (4xx, incluindo limite de taxa, ou erro de
  // aplicação): nada foi criado.
  if (error instanceof JuditHttpError && error.status < 500) {
    return {
      outcome: "failed",
      reason: `A JUDIT recusou o monitoramento (HTTP ${error.status}${error.errorName ? `, ${error.errorName}` : ""}).`,
    };
  }
  if (error instanceof JuditApplicationError) {
    return {
      outcome: "failed",
      reason: `A JUDIT recusou o monitoramento (${error.code ?? "application_error"}).`,
    };
  }
  // Timeout, rede, 5xx ou resposta 201 em formato inesperado: a JUDIT pode
  // ter criado. Reenviar arriscaria um duplicado com cobrança recorrente.
  return {
    outcome: "uncertain",
    reason:
      error instanceof Error
        ? `Sem resposta clara da JUDIT: ${error.message}`
        : "Sem resposta clara da JUDIT.",
  };
}

// --- Monitoramentos confirmados -------------------------------------------

// GET /tracking/{id}: status atual, hora da execução e recorrência.
export async function refreshTrackingAction(
  id: string,
): Promise<TrackingActionResult> {
  return withConfirmedTracking(id, async (tracking, juditId) => {
    const remote = await getJuditTracking(juditId);
    return {
      tracking: await applyRemote(tracking, remote),
      message: `Status na JUDIT: ${remote.status}.`,
    };
  });
}

export async function pauseTrackingAction(
  id: string,
): Promise<TrackingActionResult> {
  return withConfirmedTracking(id, async (tracking, juditId) => {
    const remote = await pauseJuditTracking(juditId);
    return {
      tracking: await applyRemote(tracking, remote),
      message: "Monitoramento pausado na JUDIT. Pode ser reativado.",
    };
  });
}

export async function resumeTrackingAction(
  id: string,
): Promise<TrackingActionResult> {
  return withConfirmedTracking(id, async (tracking, juditId) => {
    const remote = await resumeJuditTracking(juditId);
    return {
      tracking: await applyRemote(tracking, remote),
      message: "Monitoramento reativado na JUDIT.",
    };
  });
}

// DELETE /tracking/{id}: definitivo, segundo a documentação. O registro
// local continua como histórico, com status "deleted".
export async function deleteTrackingAction(
  id: string,
): Promise<TrackingActionResult> {
  return withConfirmedTracking(id, async (tracking, juditId) => {
    const remote = await deleteJuditTracking(juditId);
    return {
      tracking: await applyRemote(tracking, remote),
      message:
        "Monitoramento excluído na JUDIT. Esta ação não pode ser desfeita.",
    };
  });
}

export type TrackingResultsActionResult =
  | { ok: true; tracking: Tracking; results: ResponsesSummary }
  | Unavailable
  | JuditActionFailure;

// GET /responses/tracking/{tracking_id}: o que as execuções encontraram. A
// documentação exige um intervalo de datas; usamos da véspera da criação até
// o dia seguinte a hoje, para não perder nada por fuso horário.
export async function trackingResultsAction(
  id: string,
): Promise<TrackingResultsActionResult> {
  if (getDataSource() !== "db") return unavailable();
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return invalid("Identificador inválido.");

  try {
    const tracking = await getTracking(parsedId.data);
    if (!tracking?.juditTrackingId || tracking.creation !== "confirmed") {
      return invalid("Monitoramento não confirmado pela JUDIT.");
    }
    const day = 24 * 60 * 60 * 1000;
    const list = await listTrackingResponses({
      trackingId: tracking.juditTrackingId,
      createdAtGte: dateOnly(new Date(tracking.createdAt.getTime() - day)),
      createdAtLte: dateOnly(new Date(Date.now() + day)),
    });
    const company =
      tracking.searchType === "cnpj"
        ? await getCompanyByCnpj(tracking.searchKey)
        : null;
    return {
      ok: true,
      tracking,
      results: summarizeResponses(list, company),
    };
  } catch (error) {
    return juditActionFailure(error, "trackings");
  }
}

// Só agimos sobre monitoramentos criados por esta aplicação. A allowlist do
// client não cobre chamadas por ID (README da integração); exigir o registro
// confirmado no nosso banco é a barreira que impede mexer em monitoramentos
// de terceiros que usem a mesma chave.
async function withConfirmedTracking(
  id: string,
  run: (
    tracking: Tracking,
    juditTrackingId: string,
  ) => Promise<{ tracking: Tracking; message: string }>,
): Promise<TrackingActionResult> {
  if (getDataSource() !== "db") return unavailable();
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return invalid("Identificador inválido.");

  try {
    const tracking = await getTracking(parsedId.data);
    if (!tracking?.juditTrackingId || tracking.creation !== "confirmed") {
      return invalid("Monitoramento não confirmado pela JUDIT.");
    }
    const result = await run(tracking, tracking.juditTrackingId);
    refresh();
    return { ok: true, ...result };
  } catch (error) {
    return juditActionFailure(error, "trackings");
  }
}

async function applyRemote(
  tracking: Tracking,
  remote: JuditTracking,
): Promise<Tracking> {
  return (
    (await applyRemoteTracking(tracking.id, remoteFields(remote))) ?? tracking
  );
}

function remoteFields(remote: JuditTracking) {
  return {
    status: remote.status,
    recurrenceDays: remote.recurrence,
    hourRange: remote.hour_range,
  };
}

// O formato de data do exemplo da documentação ("2024-03-05T00:00:00").
function dateOnly(date: Date): string {
  return `${date.toISOString().slice(0, 10)}T00:00:00`;
}

const idSchema = z.string().min(1).max(100);

function invalid(message: string): Unavailable {
  return { ok: false, reason: "invalid", message };
}
