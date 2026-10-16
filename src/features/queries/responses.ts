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

export type ResponsesSummary = {
  lawsuits: Lawsuit[];
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
    const lawsuit =
      item.response_type === "lawsuit"
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
