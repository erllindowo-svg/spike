import "server-only";

import { fromJuditLawsuit } from "@/features/processes/judit";
import type { Lawsuit } from "@/features/processes/types";
import { lawsuitSchema } from "@/lib/judit/schemas/lawsuits";
import {
  responseCameFromCache,
  type ResponseList,
} from "@/lib/judit/schemas/requests";

// Resumo de uma página de respostas da JUDIT (GET /responses de uma
// consulta assíncrona ou GET /responses/tracking de um monitoramento; as
// duas têm o mesmo formato). Os processos vão para a tela e não são gravados.

// Um mandado de prisão (https://docs.judit.io/schemas/warrant), só com o que
// a tela mostra. Campos ausentes ficam nulos.
export type WarrantView = {
  code: string | null;
  number: string | null;
  warrantType: string | null;
  arrestType: string | null;
  status: string | null;
  issueDate: string | null;
  expirationDate: string | null;
  judgementSummary: string | null;
};

export type ResponsesSummary = {
  // Processos e, nas consultas de execução penal, processos de execução (o
  // objeto tem o formato de um processo).
  lawsuits: Lawsuit[];
  warrants: WarrantView[];
  // Resumo escrito pela IA da JUDIT (judit_ia: ["summary"]), em texto.
  aiSummary: string | null;
  // Total informado pela JUDIT e quantos vieram nesta página.
  totalResponses: number;
  loadedResponses: number;
  // Respostas que vieram do cache da JUDIT (cached_response: true).
  cachedResponses: number;
  // Itens com response_type "application_error" (ex.: nada encontrado).
  applicationErrors: string[];
  // Itens com outro response_type ou com formato inesperado.
  ignoredResponses: number;
};

// `party` é a parte do documento consultado, usada para descobrir o lado dela
// em cada processo. Um monitoramento por CNJ pode não ter parte.
export function summarizeResponses(
  list: ResponseList,
  party: { id: string; document: string } | null,
): ResponsesSummary {
  const summary: ResponsesSummary = {
    lawsuits: [],
    warrants: [],
    aiSummary: null,
    totalResponses: list.all_count,
    loadedResponses: list.page_data.length,
    cachedResponses: 0,
    applicationErrors: [],
    ignoredResponses: 0,
  };
  for (const item of list.page_data) {
    if (responseCameFromCache(item) === true) summary.cachedResponses++;

    if (item.response_type === "application_error") {
      summary.applicationErrors.push(applicationErrorText(item.response_data));
      continue;
    }
    if (item.response_type === "warrant") {
      const warrant = toWarrant(item.response_data);
      if (warrant) summary.warrants.push(warrant);
      else summary.ignoredResponses++;
      continue;
    }
    if (item.response_type === "summary") {
      const written = summaryText(item.response_data);
      if (written) summary.aiSummary = written;
      else summary.ignoredResponses++;
      continue;
    }
    const lawsuit =
      item.response_type === "lawsuit" || item.response_type === "execution"
        ? lawsuitSchema.safeParse(item.response_data)
        : null;
    if (!lawsuit?.success) {
      summary.ignoredResponses++;
      continue;
    }
    summary.lawsuits.push(fromJuditLawsuit(lawsuit.data, party));
  }
  return summary;
}

// O formato de `response_data` de um application_error varia nos exemplos da
// documentação; mostramos o código/mensagem quando existirem.
function applicationErrorText(data: unknown): string {
  if (typeof data === "object" && data !== null) {
    const { code, message } = data as Record<string, unknown>;
    const parts = [code, message].filter(
      (part): part is string | number =>
        typeof part === "string" || typeof part === "number",
    );
    if (parts.length > 0) return parts.join(": ");
  }
  return "Erro de aplicação sem descrição.";
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function toWarrant(data: unknown): WarrantView | null {
  if (typeof data !== "object" || data === null) return null;
  const d = data as Record<string, unknown>;
  return {
    code: text(d.code),
    number: text(d.number),
    warrantType: text(d.warrant_type),
    arrestType: text(d.arrest_type),
    status: text(d.status),
    issueDate: text(d.issue_date),
    expirationDate: text(d.expiration_date),
    judgementSummary: text(d.judgementSummary),
  };
}

// O resumo vem em `response_data.data`, uma lista de textos em markdown com
// HTML misturado (exemplo em https://docs.judit.io/requests/requests). A tela
// mostra só o texto: as tags são removidas, nunca interpretadas, porque o
// conteúdo vem de fora.
export function summaryText(data: unknown): string | null {
  if (typeof data !== "object" || data === null) return null;
  const parts = (data as { data?: unknown }).data;
  if (!Array.isArray(parts)) return null;
  const joined = parts
    .filter((part): part is string => typeof part === "string")
    .join("\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|li|ul|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
  return joined === "" ? null : joined;
}
