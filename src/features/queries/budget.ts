import "server-only";

import { getDb } from "@/db";
import { collections } from "@/db/collections";
import { getServerEnv } from "@/lib/env";
import { JuditDailyBudgetError } from "@/lib/judit/errors";

// Teto diário de chamadas cobradas (círculo 2, escolha S3 de
// docs/etapa-7-escopo.md). Conta no histórico que o app já guarda, em vez de
// um contador à parte:
//
//   sync_queries     cada consulta síncrona que chegou à JUDIT
//   judit_requests   cada consulta assíncrona criada
//   trackings        cada monitoramento confirmado pela JUDIT
//
// Limitações conhecidas: chamadas das rotas de dev não entram (não ficam no
// histórico), e duas ações no mesmo instante podem passar juntas pelo último
// lugar livre. É uma proteção contra exagero, não uma contabilidade exata;
// o valor oficial é o da JUDIT (consumo do ciclo).

export const DEFAULT_DAILY_CALL_LIMIT = 50;

export function dailyCallLimit(): number {
  return getServerEnv("JUDIT_DAILY_CALL_LIMIT") ?? DEFAULT_DAILY_CALL_LIMIT;
}

const dayInSaoPaulo = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

// Meia-noite de hoje no fuso do app. O Brasil não tem horário de verão desde
// 2019, então o deslocamento é sempre -03:00.
export function startOfDayInSaoPaulo(now: Date): Date {
  return new Date(`${dayInSaoPaulo.format(now)}T00:00:00-03:00`);
}

export async function countBilledCallsSince(since: Date): Promise<number> {
  const { syncQueries, juditRequests, trackings } = collections(await getDb());
  const counts = await Promise.all([
    syncQueries.countDocuments({ createdAt: { $gte: since } }),
    juditRequests.countDocuments({ createdAt: { $gte: since } }),
    trackings.countDocuments({
      createdAt: { $gte: since },
      juditTrackingId: { $type: "string" },
    }),
  ]);
  return counts.reduce((sum, count) => sum + count, 0);
}

export async function billedCallsToday(now = new Date()): Promise<number> {
  return countBilledCallsSince(startOfDayInSaoPaulo(now));
}

// Chamada por cada action cobrada, antes da JUDIT. O erro é um
// JuditGuardError: quem chama já trata "barrado antes de sair do servidor".
export async function assertDailyBudget(now = new Date()): Promise<void> {
  const limit = dailyCallLimit();
  const used = await billedCallsToday(now);
  if (used >= limit) throw new JuditDailyBudgetError(limit, used);
}
