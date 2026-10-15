"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { getDataSource } from "@/lib/data";

import { markAlertRead, markAllAlertsRead } from "./db";

// "Marcar como lido" no modo "db". Grava `readAt` e chama refresh(): o
// layout relê os alertas do banco. No modo demo, a leitura fica só na
// memória do navegador (src/lib/demo-store.tsx).

export type AlertActionResult = { ok: true } | { ok: false; message: string };

export async function markAlertReadAction(
  id: string,
): Promise<AlertActionResult> {
  if (getDataSource() !== "db") return unavailable();
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) {
    return { ok: false, message: "Identificador de alerta inválido." };
  }
  return run(() => markAlertRead(parsed.data));
}

export async function markAllAlertsReadAction(): Promise<AlertActionResult> {
  if (getDataSource() !== "db") return unavailable();
  return run(() => markAllAlertsRead());
}

async function run(write: () => Promise<unknown>): Promise<AlertActionResult> {
  try {
    await write();
    refresh();
    return { ok: true };
  } catch (error) {
    console.error(
      "[alerts] falha ao gravar a leitura:",
      error instanceof Error ? error.message : String(error),
    );
    return {
      ok: false,
      message: "Banco de dados indisponível. Tente novamente em instantes.",
    };
  }
}

function unavailable(): AlertActionResult {
  return { ok: false, message: "Disponível só no modo banco de dados." };
}
