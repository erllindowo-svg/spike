import "server-only";

import {
  JuditError,
  JuditGuardError,
  JuditLiveCallsDisabledError,
  JuditTimeoutError,
} from "@/lib/judit/errors";

// Converte uma falha numa chamada à JUDIT em uma resposta para a interface.
// Usada pelas server actions de consulta (síncrona e assíncrona) e de
// monitoramento, para que as mensagens e o registro no log sejam iguais em
// todas.

export type JuditActionFailure = {
  ok: false;
  reason:
    "live_calls_disabled" | "not_allowed" | "cost_guard" | "timeout" | "error";
  message: string;
};

export function juditActionFailure(
  error: unknown,
  logTag: string,
): JuditActionFailure {
  if (error instanceof JuditLiveCallsDisabledError) {
    return {
      ok: false,
      reason: "live_calls_disabled",
      message: 'Chamadas reais desligadas. Defina JUDIT_LIVE_CALLS="enabled".',
    };
  }
  // Proteções de custo (limite por minuto, chamada repetida, teto diário):
  // nada saiu do servidor. A mensagem da classe diz qual e o que fazer.
  if (error instanceof JuditGuardError && error.kind !== "guard") {
    return { ok: false, reason: "cost_guard", message: error.message };
  }
  if (error instanceof JuditGuardError) {
    return {
      ok: false,
      reason: "not_allowed",
      message:
        "Este documento não está na allowlist (modo restrito, src/lib/judit/guard.ts).",
    };
  }
  if (error instanceof JuditTimeoutError) {
    return {
      ok: false,
      reason: "timeout",
      message:
        "A JUDIT não respondeu a tempo. A operação pode ter sido concluída (e cobrada) mesmo assim; confira o estado antes de repetir.",
    };
  }

  // As mensagens das classes JuditError não carregam a chave nem o payload
  // (regra de errors.ts), então podem ir para o log do servidor. Erros de
  // outra origem (ex.: driver do MongoDB) registram só a mensagem.
  console.error(
    `[${logTag}] falha ao consultar a JUDIT:`,
    error instanceof JuditError
      ? `${error.name} (${error.kind}): ${error.message}`
      : error instanceof Error
        ? error.message
        : error,
  );
  return {
    ok: false,
    reason: "error",
    message:
      error instanceof JuditError
        ? `A JUDIT retornou um erro (${error.kind}). Detalhes no log do servidor.`
        : "Erro inesperado no servidor. Detalhes no log.",
  };
}
