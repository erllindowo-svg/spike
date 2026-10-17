import type { Party, Tracking } from "@/db/models";
import { identify } from "@/features/consult/identify";
import {
  displayDocument,
  DOCUMENTS,
  partyHref,
} from "@/features/parties/documents";
import { formatCnj, normalizeCnj } from "@/features/processes/cnj";
import type { Lawsuit } from "@/features/processes/types";
import { isTrackingClosed } from "@/features/trackings/types";

// Sugestões da barra de pesquisa (escolha R4 do escopo). Tudo vem do que o
// app já tem; a JUDIT só entra por um item explícito, "Consultar na JUDIT",
// que abre a página Consultar (onde cada consulta mostra o custo). Nada é
// consultado só por digitar.

export type SearchSuggestion = {
  id: string;
  kind: "party" | "tracking" | "lawsuit" | "consult";
  label: string;
  description: string;
  href: string;
};

const MAX_SUGGESTIONS = 7;

export function buildSuggestions(
  rawQuery: string,
  data: { parties: Party[]; trackings: Tracking[]; lawsuits: Lawsuit[] },
): SearchSuggestion[] {
  const query = rawQuery.trim();
  if (query.length < 2) return [];

  const term = query.toLowerCase();
  const digits = query.toUpperCase().replace(/[^0-9A-Z]/g, "");
  const suggestions: SearchSuggestion[] = [];
  const monitored = new Set(
    data.trackings
      .filter((t) => !isTrackingClosed(t))
      .map((t) => `${t.searchType}:${t.searchKey}`),
  );

  // Partes: pelo nome ou por parte do documento.
  for (const party of data.parties) {
    const byName = !!party.name?.toLowerCase().includes(term);
    const byDocument = digits.length >= 3 && party.document.includes(digits);
    if (!byName && !byDocument) continue;
    const info = DOCUMENTS[party.documentType];
    const isMonitored = monitored.has(
      `${party.documentType}:${party.document}`,
    );
    suggestions.push({
      id: `party:${party.id}`,
      kind: "party",
      label: party.name ?? displayDocument(party.documentType, party.document),
      description: [
        info.partyLabel,
        displayDocument(party.documentType, party.document),
        isMonitored ? "monitorada" : null,
      ]
        .filter(Boolean)
        .join(" · "),
      href: partyHref(party.documentType, party.document),
    });
  }

  // Processos: monitoramentos por CNJ e processos conhecidos.
  const cnj = normalizeCnj(query);
  if (cnj.length >= 7 && /^[\d.\-\s]+$/.test(query)) {
    for (const tracking of data.trackings) {
      if (tracking.searchType !== "cnj" || !tracking.searchKey.includes(cnj)) {
        continue;
      }
      suggestions.push({
        id: `tracking:${tracking.id}`,
        kind: "tracking",
        label: formatCnj(tracking.searchKey),
        description: "Monitoramento processual",
        href: `/informacoes/cnj/${tracking.searchKey}`,
      });
    }
    for (const lawsuit of data.lawsuits) {
      if (!lawsuit.cnj.includes(cnj)) continue;
      suggestions.push({
        id: `lawsuit:${lawsuit.id}`,
        kind: "lawsuit",
        label: formatCnj(lawsuit.cnj),
        description: `Processo · ${lawsuit.tribunal}`,
        href: `/informacoes/cnj/${lawsuit.cnj}`,
      });
    }
  }

  const found = suggestions.slice(0, MAX_SUGGESTIONS - 1);

  // Um identificador completo e válido pode ser consultado na JUDIT.
  const target = consultTarget(query);
  if (target) {
    const label =
      target.type === "cnj"
        ? `processo ${formatCnj(target.key)}`
        : `${DOCUMENTS[target.type].label} ${displayDocument(target.type, target.key)}`;
    found.push({
      id: `consult:${target.type}:${target.key}`,
      kind: "consult",
      label: `Consultar ${label} na JUDIT`,
      description: "Abre a página Consultar. Cada consulta é cobrada.",
      href: `/?valor=${target.key}`,
    });
  }
  return found;
}

function consultTarget(
  query: string,
): { type: "cnpj" | "cpf" | "cnj"; key: string } | null {
  const result = identify(query);
  if (result.status !== "recognized") return null;
  const { type, key } = result.candidates[0];
  return type === "cnpj" || type === "cpf" || type === "cnj"
    ? { type, key }
    : null;
}
