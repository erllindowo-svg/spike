// Modelo de exibição de processos. Ainda não existe tabela correspondente:
// os dados virão das respostas da JUDIT e quase todos os campos podem faltar.

export type LawsuitStatus = "active" | "archived" | "suspended";

// Lado da empresa no processo (equivalente ao "side" das partes).
export type CompanyRole = "active" | "passive" | "interested";

export type LawsuitMovement = {
  id: string;
  occurredAt: Date;
  description: string;
};

export type Lawsuit = {
  id: string;
  cnj: string;
  companyId: string | null;
  tribunal: string;
  area: string | null;
  className: string | null;
  subject: string | null;
  judgingBody: string | null;
  companyRole: CompanyRole | null;
  status: LawsuitStatus | null;
  distributedAt: Date | null;
  lastMovementAt: Date | null;
  amount: number | null;
  movements: LawsuitMovement[];
};

export const lawsuitStatusLabels: Record<LawsuitStatus, string> = {
  active: "Em andamento",
  archived: "Arquivado",
  suspended: "Suspenso",
};

export const companyRoleLabels: Record<CompanyRole, string> = {
  active: "Polo ativo",
  passive: "Polo passivo",
  interested: "Terceiro interessado",
};

export type DistributionDatum = {
  label: string;
  value: number;
};

export type DistributionDimension = "area" | "tribunal";

// Agrupa processos por uma dimensão. Valores ausentes viram "Não informado".
export function summarizeDistribution(
  lawsuits: Lawsuit[],
  dimension: DistributionDimension,
): DistributionDatum[] {
  const counts = new Map<string, number>();
  for (const lawsuit of lawsuits) {
    const key = lawsuit[dimension] ?? "Não informado";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
}
