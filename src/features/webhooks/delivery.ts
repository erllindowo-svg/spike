import { normalizeCnj } from "@/features/processes/cnj";

// O que uma entrega gravada diz, segundo o contrato da JUDIT. Só leitura do
// payload, sem decisão nenhuma: as regras do app ficam em process.ts.
//
// Documentado em https://docs.judit.io/webhook/callbacks ("Eventos
// enviados"): todo webhook tem `event_type: "response_created"`, e o que
// diferencia as entregas é `payload.response_type`:
//
//   lawsuit            um processo (de uma consulta ou de um monitoramento)
//   application_info   fim do fluxo (600) ou monitoramento pausado (700-703)
//   application_error  falha na consulta ou requisição expirada
//
// O payload lido aqui é o GRAVADO (envelope.ts): num processo, o
// `response_data` já virou um resumo que mantém o `code` (o CNJ).

// "Monitoramento pausado por teto de consumo ou saldo", mesma página.
export const TRACKING_PAUSE_REASONS = {
  700: "o consumo atingiu o teto do plano",
  701: "o saldo de créditos não cobre novos itens",
  702: "o limite de requisições do plano foi atingido",
  703: "o plano não tem configuração para este tipo de monitoramento",
} as const;

export type TrackingPauseCode = keyof typeof TRACKING_PAUSE_REASONS;

export const REQUEST_COMPLETED_CODE = 600;

export type Delivery =
  | { kind: "lawsuit"; cnj: string | null }
  | { kind: "request_completed" }
  | { kind: "tracking_paused"; code: TrackingPauseCode }
  | { kind: "other_info"; code: string | null }
  | { kind: "application_error"; code: string | null; message: string | null }
  | { kind: "other"; responseType: string | null };

export function readDelivery(stored: unknown): Delivery {
  const payload = field(stored, "payload");
  const responseType = text(field(payload, "response_type"));
  const data = field(payload, "response_data");
  const code = field(data, "code");

  if (responseType === "lawsuit") {
    const cnj = text(code);
    return { kind: "lawsuit", cnj: cnj ? normalizeCnj(cnj) || null : null };
  }

  if (responseType === "application_info") {
    if (code === REQUEST_COMPLETED_CODE) return { kind: "request_completed" };
    if (isPauseCode(code)) return { kind: "tracking_paused", code };
    return { kind: "other_info", code: code == null ? null : String(code) };
  }

  if (responseType === "application_error") {
    // A página de erros manda chavear pela `message` ("ex.:
    // LAWSUIT_NOT_FOUND"), mas o exemplo da mesma página traz esse nome no
    // `code`, e o OpenAPI declara `code` numérico (README da integração,
    // itens 5 e 42). Guardamos os dois, como texto.
    return {
      kind: "application_error",
      code: code == null ? null : String(code),
      message: text(field(data, "message")),
    };
  }

  return { kind: "other", responseType };
}

function isPauseCode(code: unknown): code is TrackingPauseCode {
  return typeof code === "number" && code in TRACKING_PAUSE_REASONS;
}

function field(value: unknown, key: string): unknown {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)[key]
    : undefined;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}
