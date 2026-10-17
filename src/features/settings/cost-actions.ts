"use server";

import { getDataSource } from "@/lib/data";

import { allowlistLocked, setAllowlist } from "./cost-protection";

// Server Action do interruptor da proteção de custo (círculo 5). Como toda
// Server Action, é um endpoint público: valida a entrada e recusa quando a
// trava do servidor está posta. O registro no terminal é a trilha de quem
// procurar por que o modo restrito mudou.
export async function setAllowlistAction(
  allowlist: unknown,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (typeof allowlist !== "boolean") {
    return { ok: false, message: "Valor inválido." };
  }
  if (getDataSource() !== "db") {
    return { ok: false, message: "A demonstração não chama a JUDIT." };
  }
  if (allowlistLocked()) {
    return {
      ok: false,
      message: 'Travado no servidor (JUDIT_ALLOWLIST="locked").',
    };
  }
  try {
    await setAllowlist(allowlist);
  } catch {
    return { ok: false, message: "O banco não respondeu; nada mudou." };
  }
  console.info(
    `[cost] modo restrito ${allowlist ? "ligado" : "desligado"} pelo interruptor`,
  );
  return { ok: true };
}
