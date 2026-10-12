// Camada de acesso aos dados de demonstração. As assinaturas imitam consultas
// futuras ao banco/JUDIT para que os mocks possam ser trocados sem mexer na UI.

import type { ActivityItem } from "@/features/activity/types";
import type { AlertView } from "@/features/alerts/types";
import { normalizeCnpj } from "@/features/companies/cnpj";
import type { Company } from "@/features/companies/types";
import { normalizeCnj } from "@/features/processes/cnj";
import type { Lawsuit } from "@/features/processes/types";
import type { Tracking } from "@/features/trackings/types";
import type { WebhookEventView } from "@/features/webhooks/types";

import * as mock from "./mock-data";

export function listCompanies(): Company[] {
  return [...mock.companies].sort((a, b) =>
    (a.legalName ?? a.cnpj).localeCompare(b.legalName ?? b.cnpj, "pt-BR"),
  );
}

export function getCompanyByCnpj(cnpj: string): Company | null {
  const normalized = normalizeCnpj(cnpj);
  return mock.companies.find((c) => c.cnpj === normalized) ?? null;
}

export function listLawsuits(filter?: { companyId?: string }): Lawsuit[] {
  return mock.lawsuits
    .filter((l) => !filter?.companyId || l.companyId === filter.companyId)
    .sort(
      (a, b) =>
        (b.lastMovementAt?.getTime() ?? 0) - (a.lastMovementAt?.getTime() ?? 0),
    );
}

export function getLawsuitByCnj(cnj: string): Lawsuit | null {
  const normalized = normalizeCnj(cnj);
  return mock.lawsuits.find((l) => l.cnj === normalized) ?? null;
}

const byDateDesc =
  <T>(key: (item: T) => Date) =>
  (a: T, b: T) =>
    key(b).getTime() - key(a).getTime();

export type DemoState = {
  trackings: Tracking[];
  alerts: AlertView[];
  webhookEvents: WebhookEventView[];
  activity: ActivityItem[];
};

// Coleções mutáveis na demonstração; a interface as mantém em memória.
export function getInitialDemoState(): DemoState {
  return {
    trackings: [...mock.trackings].sort(byDateDesc((t) => t.updatedAt)),
    alerts: [...mock.alerts].sort(byDateDesc((a) => a.createdAt)),
    webhookEvents: [...mock.webhookEvents].sort(
      byDateDesc((e) => e.receivedAt),
    ),
    activity: [...mock.activity].sort(byDateDesc((a) => a.occurredAt)),
  };
}

export { DEMO_NOW } from "./mock-data";
