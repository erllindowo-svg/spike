import type { DistributionDatum } from "@/features/processes/types";
import type { Lawsuit } from "@/features/processes/types";
import type { RegistrationData } from "@/features/parties/registration";
import type { LawsuitsSyntheticResponse } from "@/lib/judit/schemas/lawsuits";

// O que cada consulta avulsa devolve à tela. Os dados não são gravados: a
// fonte continua sendo a JUDIT, e o histórico (sync_queries) guarda só os
// metadados da chamada.

export type SyntheticGroup = {
  title: string;
  data: DistributionDatum[];
};

export type ConsultPayload =
  | { kind: "count"; total: number }
  | { kind: "synthetic"; total: number | null; groups: SyntheticGroup[] }
  | { kind: "lawsuits"; lawsuits: Lawsuit[]; total: number }
  | { kind: "registration"; registration: RegistrationData }
  | { kind: "lawsuit"; lawsuits: Lawsuit[] }
  | { kind: "async"; requestId: string };

// "Active" / "Passive"... como a JUDIT escreve o lado da parte; o que não
// estiver aqui aparece como veio.
const sideLabels: Record<string, string> = {
  ACTIVE: "Polo ativo",
  PASSIVE: "Polo passivo",
  INTERESTED: "Interessado",
  UNKNOWN: "Não identificado",
};

// Eixos do resumo agrupado que a tela mostra, na ordem. A documentação lista
// mais (classes, assuntos, justiça, estado, instância, tipo de pessoa); os
// quatro abaixo bastam para uma primeira leitura de risco.
const AXES = [
  ["tribunals", "Tribunal"],
  ["areas", "Área"],
  ["phases", "Fase"],
  ["sides", "Lado da parte"],
] as const;

export function syntheticGroups(
  response: LawsuitsSyntheticResponse,
): SyntheticGroup[] {
  return AXES.flatMap(([axis, title]) => {
    const buckets = response[axis] ?? [];
    const data = buckets
      .map((bucket) => {
        const raw = String(bucket.value);
        const label =
          axis === "sides" ? (sideLabels[raw.toUpperCase()] ?? raw) : raw;
        return { label: label || "Não informado", value: bucket.count };
      })
      .filter((datum) => datum.value > 0)
      .sort((a, b) => b.value - a.value);
    return data.length > 0 ? [{ title, data }] : [];
  });
}
