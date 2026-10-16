import "server-only";

import { getServerEnv } from "@/lib/env";

import { JuditDuplicateCallError, JuditLocalRateLimitError } from "./errors";

// Cost protections that run in the client, before any network activity
// (stage 7, circle 2, choice S2 in docs/etapa-7-escopo.md):
//
// 1. Pace: at most N calls in any 60 s window (sliding, like JUDIT's own
//    limit). JUDIT allows 180 per minute per key (README item 43); ours
//    defaults to 30, so a loop or a stuck button hits our wall first.
// 2. Single flight: one billable call (POST, PATCH, DELETE) at a time for the
//    same method, path and body. A double click or two tabs would otherwise
//    send, and pay for, the same search twice.
//
// The state lives in this server process's memory. A restart clears it, and
// several instances would each have their own counters; that is enough for
// one dev server. Shared limits would need the database (as the daily cap in
// src/features/queries/budget.ts does).

const WINDOW_MS = 60_000;
export const DEFAULT_CALLS_PER_MINUTE = 30;

type LimitState = { calls: number[]; inFlight: Set<string> };

// Kept on globalThis so a dev hot reload does not reset the counters.
const globalForLimits = globalThis as unknown as {
  juditCallLimits?: LimitState;
};

function limitState(): LimitState {
  globalForLimits.juditCallLimits ??= { calls: [], inFlight: new Set() };
  return globalForLimits.juditCallLimits;
}

export function callsPerMinuteLimit(): number {
  return getServerEnv("JUDIT_MAX_CALLS_PER_MINUTE") ?? DEFAULT_CALLS_PER_MINUTE;
}

// Counts one call in the window, or refuses it.
export function reserveCallSlot(now = Date.now()): void {
  const state = limitState();
  state.calls = state.calls.filter((at) => now - at < WINDOW_MS);
  const limit = callsPerMinuteLimit();
  if (state.calls.length >= limit) {
    const oldest = state.calls[0];
    throw new JuditLocalRateLimitError(limit, WINDOW_MS - (now - oldest));
  }
  state.calls.push(now);
}

// Runs `call` unless an identical one is still running. `key` null means the
// call is a read (GET) and may run in parallel.
export async function runSingleFlight<T>(
  key: string | null,
  call: () => Promise<T>,
): Promise<T> {
  if (key === null) return call();
  const { inFlight } = limitState();
  if (inFlight.has(key)) throw new JuditDuplicateCallError();
  inFlight.add(key);
  try {
    return await call();
  } finally {
    inFlight.delete(key);
  }
}

// Calls made in the current window, for the settings screen.
export function callsInLastMinute(now = Date.now()): number {
  return limitState().calls.filter((at) => now - at < WINDOW_MS).length;
}

// Tests only.
export function resetCallLimits(): void {
  globalForLimits.juditCallLimits = { calls: [], inFlight: new Set() };
}
