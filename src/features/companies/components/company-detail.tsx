"use client";

import {
  CalendarClockIcon,
  CheckCircle2Icon,
  FileTextIcon,
  LandmarkIcon,
  RadarIcon,
  ScaleIcon,
} from "lucide-react";
import { useState } from "react";

import { CopyButton } from "@/components/shared/copy-button";
import { EmptyState } from "@/components/shared/empty-state";
import { StatCard } from "@/components/shared/stat-card";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ActivityFeed } from "@/features/activity/components/activity-feed";
import { formatCnpj } from "@/features/companies/cnpj";
import type { Company } from "@/features/companies/types";
import {
  DistributionCard,
  type DistributionData,
} from "@/features/processes/components/distribution-card";
import { LawsuitSheet } from "@/features/processes/components/lawsuit-sheet";
import { LawsuitsTable } from "@/features/processes/components/lawsuits-table";
import type { Lawsuit } from "@/features/processes/types";
import { useNewTrackingDialog } from "@/features/trackings/components/new-tracking-dialog";
import { SearchTypeBadge } from "@/features/trackings/components/search-type-badge";
import { TrackingStatusBadge } from "@/features/trackings/components/tracking-status-badge";
import { formatSearchKey } from "@/features/trackings/format";
import {
  formatRecurrence,
  getTrackingDisplayState,
} from "@/features/trackings/types";
import { useDemoStore } from "@/lib/demo-store";
import { formatDate, formatNumber } from "@/lib/format";

import { RegistrationStatusBadge } from "./registration-status-badge";

export function CompanyDetail({
  company,
  lawsuits,
  distribution,
}: {
  company: Company;
  lawsuits: Lawsuit[];
  distribution: DistributionData;
}) {
  const { trackings, activity } = useDemoStore();
  const { openNewTracking } = useNewTrackingDialog();
  const [selected, setSelected] = useState<Lawsuit | null>(null);

  const lawsuitCnjs = new Set(lawsuits.map((l) => l.cnj));
  const linkedTrackings = trackings.filter(
    (t) =>
      t.companyId === company.id ||
      (t.searchType === "cnpj" && t.searchKey === company.cnpj) ||
      (t.searchType === "cnj" && lawsuitCnjs.has(t.searchKey)),
  );
  const cnpjTracking = linkedTrackings.find(
    (t) =>
      t.searchType === "cnpj" &&
      getTrackingDisplayState(t.status) !== "completed",
  );
  const companyActivity = activity.filter((a) => a.companyId === company.id);
  const activeCount = lawsuits.filter((l) => l.status === "active").length;
  const tribunals = new Set(lawsuits.map((l) => l.tribunal)).size;
  const lastMovement = lawsuits
    .map((l) => l.lastMovementAt)
    .filter((d): d is Date => d !== null)
    .sort((a, b) => b.getTime() - a.getTime())[0];

  return (
    <>
      <Card>
        <CardContent className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-heading text-xl font-semibold tracking-tight">
                {company.legalName ?? (
                  <span className="text-muted-foreground">
                    Razão social indisponível
                  </span>
                )}
              </h2>
              <RegistrationStatusBadge status={company.registrationStatus} />
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="font-mono text-foreground">
                CNPJ {formatCnpj(company.cnpj)}
              </span>
              <span>Consultada em {formatDate(company.createdAt)}</span>
              {!company.legalName && (
                <span>Dados cadastrais ainda não retornados.</span>
              )}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <CopyButton
              value={company.cnpj}
              label="Copiar CNPJ"
              successMessage="CNPJ copiado."
            />
            {cnpjTracking ? (
              <span className="inline-flex h-8 items-center gap-2 rounded-lg border px-2.5 text-sm">
                <CheckCircle2Icon className="size-4 text-success" aria-hidden />
                Monitorado por CNPJ
                <TrackingStatusBadge status={cnpjTracking.status} />
              </span>
            ) : (
              <Button
                onClick={() =>
                  openNewTracking({
                    searchType: "cnpj",
                    searchKey: company.cnpj,
                  })
                }
              >
                <RadarIcon data-icon="inline-start" />
                Monitorar CNPJ
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <section
        aria-label="Indicadores da empresa"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <StatCard
          label="Processos encontrados"
          value={formatNumber(lawsuits.length)}
          icon={ScaleIcon}
        />
        <StatCard
          label="Em andamento"
          value={formatNumber(activeCount)}
          hint={
            lawsuits.length
              ? `${Math.round((activeCount / lawsuits.length) * 100)}% do total`
              : undefined
          }
          icon={FileTextIcon}
        />
        <StatCard
          label="Tribunais distintos"
          value={formatNumber(tribunals)}
          icon={LandmarkIcon}
        />
        <StatCard
          label="Última movimentação"
          value={lastMovement ? formatDate(lastMovement) : "—"}
          hint={lastMovement ? undefined : "Nenhuma movimentação conhecida"}
          icon={CalendarClockIcon}
        />
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <DistributionCard
          data={distribution}
          description="Processos desta empresa por agrupamento."
        />
        <Card>
          <CardHeader>
            <CardTitle>Monitoramentos vinculados</CardTitle>
            <CardDescription>
              Por CNPJ e por processos da empresa.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {linkedTrackings.length === 0 ? (
              <EmptyState
                icon={RadarIcon}
                title="Nenhum monitoramento"
                description="Monitore o CNPJ para ser avisado sobre novos processos."
                className="py-6"
              />
            ) : (
              <ul className="flex flex-col divide-y">
                {linkedTrackings.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                  >
                    <div className="flex min-w-0 flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <SearchTypeBadge type={t.searchType} />
                        <span className="truncate font-mono text-xs">
                          {formatSearchKey(t.searchType, t.searchKey)}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatRecurrence(t.recurrenceDays)} · desde{" "}
                        {formatDate(t.createdAt)}
                      </span>
                    </div>
                    <TrackingStatusBadge status={t.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card className="lg:col-span-2 xl:col-span-1">
          <CardHeader>
            <CardTitle>Atividade recente</CardTitle>
            <CardDescription>
              Eventos relacionados a esta empresa.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ActivityFeed items={companyActivity} limit={5} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Processos associados</CardTitle>
          <CardDescription>
            Selecione um processo para ver detalhes e movimentações.
          </CardDescription>
          <CardAction>
            <span className="text-sm text-muted-foreground tabular-nums">
              {formatNumber(lawsuits.length)} processos
            </span>
          </CardAction>
        </CardHeader>
        <CardContent>
          <LawsuitsTable lawsuits={lawsuits} onSelect={setSelected} />
        </CardContent>
      </Card>

      <LawsuitSheet
        lawsuit={selected}
        onOpenChange={(open) => !open && setSelected(null)}
      />
    </>
  );
}
