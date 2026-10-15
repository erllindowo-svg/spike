import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

import { getServerEnv } from "@/lib/env";

// Como a rota do webhook sabe que a entrega veio da JUDIT.
//
// A documentação não define assinatura (HMAC) para os webhooks: só pede HTTPS
// e sugere aceitar apenas IPs da JUDIT, com a lista pedida ao suporte
// (https://docs.judit.io/webhook/callbacks, "Validar origem"). Como é o app
// que escolhe a `callback_url` de cada requisição, ele põe um segredo nela
// (?token=...), e a rota só aceita a entrega se o segredo voltar.
//
// É mais fraco que uma assinatura: a URL completa pode ficar em logs da JUDIT
// e do túnel, e a JUDIT a devolve dentro do payload (`tags.callback_url`).
// Por isso o token nunca é gravado nem registrado no log (redactToken).
// Trocar o token invalida as `callback_url` já enviadas: entregas pendentes
// passariam a receber 401.

export const WEBHOOK_PATH = "/api/webhooks/judit";
export const WEBHOOK_TOKEN_PARAM = "token";

// undefined: webhook desligado (variável vazia ou ausente). Um valor
// inválido (menos de 32 caracteres) lança erro, como as outras variáveis.
export function getWebhookToken(): string | undefined {
  return getServerEnv("JUDIT_WEBHOOK_TOKEN");
}

// Modo manutenção: grava o payload inteiro. Só o valor exato "enabled" liga.
export function fullPayloadEnabled(): boolean {
  return getServerEnv("JUDIT_WEBHOOK_FULL_PAYLOAD") === "enabled";
}

// Compara em tempo constante, para que o tempo de resposta não revele
// quantos caracteres iniciais estavam certos. O hash antes da comparação dá
// aos dois lados o mesmo tamanho, que o timingSafeEqual exige.
export function isValidWebhookToken(
  received: string | null,
  expected: string,
): boolean {
  if (!received) return false;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(received), digest(expected));
}

// https://<origem pública>/api/webhooks/judit?token=<segredo>. A origem é a
// URL do túnel em desenvolvimento (muda a cada vez que o túnel sobe) ou o
// endereço público do app em produção. Só https: a documentação exige.
export function buildJuditCallbackUrl(publicOrigin: string): string {
  const token = getWebhookToken();
  if (!token) {
    throw new Error(
      "JUDIT_WEBHOOK_TOKEN não configurado: o webhook está desligado.",
    );
  }
  const url = new URL(WEBHOOK_PATH, publicOrigin);
  if (url.protocol !== "https:") {
    throw new Error("A origem pública do webhook precisa ser https://.");
  }
  url.searchParams.set(WEBHOOK_TOKEN_PARAM, token);
  return url.toString();
}

// Troca o token por um marcador em qualquer texto. Mesma ideia do redact de
// src/lib/judit/client.ts, que faz isso com a chave da API.
export function redactToken(text: string, token: string): string {
  return text.split(token).join("[token]");
}
