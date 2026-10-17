import "server-only";

import type { SyncQueryOutcome } from "@/db/models";
import {
  JuditError,
  JuditGuardError,
  JuditLiveCallsDisabledError,
  JuditNetworkError,
} from "@/lib/judit/errors";

import { saveSyncQuery, type NewSyncQuery } from "./db";

// Registro das consultas síncronas para a página Consultas. Quem chama já
// fez (e talvez pagou) a consulta: uma falha ao registrar não pode apagar
// esse resultado. Por isso o erro vai só para o log, e quem chamou segue.
export async function logSyncQuery(input: NewSyncQuery): Promise<void> {
  try {
    await saveSyncQuery(input);
  } catch (error) {
    console.error(
      `[queries] consulta ${input.mode} feita, mas não registrada no histórico:`,
      error instanceof Error ? error.message : String(error),
    );
  }
}

// Como registrar uma consulta que terminou em erro. `null`: não registrar,
// porque a chamada não saiu do servidor (kill switch, allowlist) ou o erro
// não veio da JUDIT (banco, bug nosso).
export function syncFailureFor(
  error: unknown,
): { outcome: SyncQueryOutcome; errorKind: string } | null {
  if (
    error instanceof JuditLiveCallsDisabledError ||
    error instanceof JuditGuardError
  ) {
    return null;
  }
  // Sem resposta (tempo esgotado ou falha de rede): não dá para saber se a
  // chamada chegou. A JUDIT pode ter processado e cobrado.
  if (error instanceof JuditNetworkError) {
    return { outcome: "uncertain", errorKind: error.kind };
  }
  if (error instanceof JuditError) {
    return { outcome: "failed", errorKind: error.kind };
  }
  return null;
}
