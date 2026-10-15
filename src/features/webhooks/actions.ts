"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { getDataSource } from "@/lib/data";

import { processWebhookEvent, type ProcessResult } from "./process";

// "Reprocessar" da tela /webhooks: roda as mesmas regras do processamento
// automático. Vale para eventos pendentes, com falha, ignorados ou presos em
// "processing" (claimWebhookEvent em db.ts). Não chama a JUDIT.

export type ReprocessResult =
  { ok: true; result: ProcessResult } | { ok: false; message: string };

export async function reprocessWebhookEventAction(
  eventId: string,
): Promise<ReprocessResult> {
  if (getDataSource() !== "db") {
    return {
      ok: false,
      message: "Reprocessar só funciona no modo banco de dados.",
    };
  }
  const parsed = z.uuid().safeParse(eventId);
  if (!parsed.success) {
    return { ok: false, message: "Identificador de evento inválido." };
  }

  try {
    const result = await processWebhookEvent(parsed.data);
    refresh();
    return { ok: true, result };
  } catch (error) {
    console.error(
      "[webhooks] reprocessar falhou:",
      error instanceof Error ? error.message : String(error),
    );
    return {
      ok: false,
      message: "Banco de dados indisponível. Tente novamente em instantes.",
    };
  }
}
