import { z } from "zod";

import type { WebhookEvent } from "@/db/models";

import { redactToken } from "./callback";

// O que chega no webhook e o que gravamos dele.
//
// Envelope documentado (https://docs.judit.io/webhook/callbacks, "Todo
// payload tem um envelope padrão"): callback_id, event_type, reference_type,
// reference_id e payload. Todos opcionais e "loose": um campo a menos não
// derruba a entrega, e um campo desconhecido é gravado como veio (pode ser
// útil no diagnóstico). Só um tipo errado (callback_id numérico, payload que
// não é objeto) recusa a entrega, porque indicaria mudança de contrato.
const envelopeSchema = z.looseObject({
  callback_id: z.string().min(1).optional(),
  event_type: z.string().optional(),
  reference_type: z.string().optional(),
  reference_id: z.string().optional(),
  payload: z
    .looseObject({
      response_type: z.string().optional(),
      response_data: z.unknown().optional(),
    })
    .optional(),
});

type Envelope = z.infer<typeof envelopeSchema>;

// Respostas pequenas, sem dados de processo: avisos de fim de fluxo e de
// pausa (`application_info`, códigos 600 e 700 a 703) e falhas
// (`application_error`). São sempre gravadas inteiras.
const KEPT_RESPONSE_TYPES = new Set(["application_info", "application_error"]);

export type NewWebhookEvent = Pick<
  WebhookEvent,
  "callbackId" | "eventType" | "referenceType" | "referenceId" | "payload"
>;

export type PreparedWebhookEvent =
  | { ok: true; event: NewWebhookEvent; responseType: string | null }
  | { ok: false; issues: string[] };

// Transforma o corpo recebido no documento a gravar.
//
// `event.payload` guarda o corpo inteiro (o envelope), não só o campo
// `payload` de dentro, para não perder campos de topo como `user_id`.
// Por padrão, o `response_data` de uma resposta de processo é trocado por um
// resumo sem valores (redução de dados): o processo continua na JUDIT e pode
// ser relido pelo `response_id`. Com `fullPayload` (modo manutenção), tudo é
// gravado. Nos dois casos, o token da `callback_url` é mascarado.
export function prepareWebhookEvent(
  body: unknown,
  options: { token: string; fullPayload: boolean },
): PreparedWebhookEvent {
  const parsed = envelopeSchema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map(
        (issue) => `${issue.path.join(".") || "(raiz)"}: ${issue.message}`,
      ),
    };
  }

  const envelope = parsed.data;
  const stored = options.fullPayload ? envelope : withoutLawsuitData(envelope);

  return {
    ok: true,
    responseType: envelope.payload?.response_type ?? null,
    event: {
      callbackId: envelope.callback_id ?? null,
      eventType: envelope.event_type ?? null,
      referenceType: envelope.reference_type ?? null,
      referenceId: envelope.reference_id ?? null,
      payload: redactDeep(stored, options.token),
    },
  };
}

function withoutLawsuitData(envelope: Envelope): Envelope {
  const payload = envelope.payload;
  if (
    !payload ||
    !("response_data" in payload) ||
    KEPT_RESPONSE_TYPES.has(payload.response_type ?? "")
  ) {
    return envelope;
  }
  return {
    ...envelope,
    payload: { ...payload, response_data: summarize(payload.response_data) },
  };
}

// Resumo sem valores: o `code` (o CNJ, numa resposta de processo) e os nomes
// dos campos. Os nomes ajudam a perceber uma mudança de formato sem guardar
// partes, documentos ou valores.
function summarize(data: unknown) {
  if (Array.isArray(data)) return { omitted: true, items: data.length };
  if (isRecord(data)) {
    return {
      omitted: true,
      keys: Object.keys(data).sort(),
      ...(typeof data.code === "string" ? { code: data.code } : {}),
    };
  }
  return { omitted: true };
}

// A JUDIT devolve a `callback_url` (com o token) em `payload.tags`. Em vez de
// apagar só esse campo, o token é trocado em qualquer texto do corpo.
function redactDeep(value: unknown, token: string): unknown {
  if (typeof value === "string") return redactToken(value, token);
  if (Array.isArray(value)) return value.map((item) => redactDeep(item, token));
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        redactDeep(item, token),
      ]),
    );
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
