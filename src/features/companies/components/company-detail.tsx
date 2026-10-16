"use client";

import {
  CalendarClockIcon,
  CheckCircle2Icon,
  CloudDownloadIcon,
  FileTextIcon,
  IdCardIcon,
  LandmarkIcon,
  RadarIcon,
  ScaleIcon,
} from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

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
import { Spinner } from "@/components/ui/spinner";
import { ActivityFeed } from "@/features/activity/components/activity-feed";
import { formatCnpj } from "@/features/companies/cnpj";
import type { Company } from "@/features/companies/types";
import type { JuditRequest } from "@/db/models";
import {
  DistributionCard,
  type DistributionData,
} from "@/features/processes/components/distribution-card";
import { LawsuitSheet } from "@/features/processes/components/lawsuit-sheet";
import { LawsuitsTable } from "@/features/processes/components/lawsuits-table";
import {
  searchCompanyLawsuitsAction,
  type SearchCompanyLawsuitsResult,
} from "@/features/processes/actions";
import {
  summarizeDistribution,
  type Lawsuit,
} from "@/features/processes/types";
import { AsyncQueriesCard } from "@/features/queries/components/async-queries-card";
import { QUERY_MODES } from "@/features/queries/modes";
import { useSupportView } from "@/features/settings/support-view";
import { useNewTrackingDialog } from "@/features/trackings/components/new-tracking-dialog";
import { SearchTypeBadge } from "@/features/trackings/components/search-type-badge";
import { TrackingStatusBadge } from "@/features/trackings/components/tracking-status-badge";
import { formatSearchKey } from "@/features/trackings/format";
import { formatRecurrence, isTrackingClosed } from "@/features/trackings/types";
import { useDemoStore } from "@/lib/demo-store";
import { formatDate, formatDateTime, formatNumber } from "@/lib/format";

import { refreshRegistrationDataAction } from "../actions";
import { RegistrationStatusBadge } from "./registration-status-badge";

type JuditSearch = Extract<SearchCompanyLawsuitsResult, { ok: true }>;

export function CompanyDetail({
  company,
  lawsuits: demoLawsuits,
  asyncQueries,
  distribution: demoDistribution,
}: {
  company: Company;
  lawsuits: Lawsuit[];
  // Consultas assíncronas gravadas no MongoDB; vazio no modo demo.
  asyncQueries: JuditRequest[];
  distribution: DistributionData;
}) {
  const { trackings, activity, dataSource } = useDemoStore();
  const { openNewTracking } = useNewTrackingDialog();
  const [selected, setSelected] = useState<Lawsuit | null>(null);
  const [judit, setJudit] = useState<JuditSearch | null>(null);
  const [searching, startSearch] = useTransition();
  const [refreshing, startRefresh] = useTransition();
  const [supportView] = useSupportView();

  // No modo "db", os processos não vêm do banco: aparecem só depois de uma
  // consulta ao datalake da JUDIT, feita sob clique porque cada uma é cobrada.
  const fromJudit = dataSource === "db";
  const lawsuits = fromJudit ? (judit?.lawsuits ?? []) : demoLawsuits;
  const distribution = fromJudit
    ? {
        area: summarizeDistribution(lawsuits, "area"),
        tribunal: summarizeDistribution(lawsuits, "tribunal"),
      }
    : demoDistribution;

  function searchJudit() {
    startSearch(async () => {
      const result = await searchCompanyLawsuitsAction(company.cnpj);
      if (!result.ok) {
        toast.error("Consulta à JUDIT não concluída", {
          description: result.message,
        });
        return;
      }
      setJudit(result);
      toast.success(
        `${formatNumber(result.total)} processo(s) na ${QUERY_MODES.datalake_sync.label.toLowerCase()}`,
      );
    });
  }

  // Dados cadastrais (POST /entities, cobrada): razão social e situação. O
  // resultado é gravado na empresa e chega pela nova renderização (refresh()).
  function refreshRegistration() {
    startRefresh(async () => {
      let result;
      try {
        result = await refreshRegistrationDataAction(company.cnpj);
      } catch {
        toast.error("Sem resposta do servidor da aplicação.");
        return;
      }
      if (!result.ok) {
        toast.error("Dados cadastrais não consultados", {
          description: result.message,
        });
        return;
      }
      if (result.registration.found) {
        toast.success("Dados cadastrais atualizados", {
          description: result.registration.legalName ?? undefined,
        });
      } else {
        toast.warning("A JUDIT não encontrou cadastro para este CNPJ.");
      }
    });
  }

  const lawsuitCnjs = new Set(lawsuits.map((l) => l.cnj));
  const linkedTrackings = trackings.filter(
    (t) =>
      t.companyId === company.id ||
      (t.searchType === "cnpj" && t.searchKey === company.cnpj) ||
      (t.searchType === "cnj" && lawsuitCnjs.has(t.searchKey)),
  );
  const cnpjTracking = linkedTrackings.find(
    (t) => t.searchType === "cnpj" && !isTrackingClosed(t),
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
                <span>Dados cadastrais ainda não consultados.</span>
              )}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {fromJudit && (
              <Button
                variant="outline"
                onClick={refreshRegistration}
                disabled={refreshing}
                title="Consulta cobrada: razão social e situação na Receita"
              >
                {refreshing ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <IdCardIcon data-icon="inline-start" />
                )}
                {company.legalName
                  ? "Atualizar dados cadastrais"
                  : "Consultar dados cadastrais"}
              </Button>
            )}
            <CopyButton
              value={company.cnpj}
              label="Copiar CNPJ"
              successMessage="CNPJ copiado."
            />
            {cnpjTracking ? (
              <span className="inline-flex h-8 items-center gap-2 rounded-lg border px-2.5 text-sm">
                <CheckCircle2Icon className="size-4 text-success" aria-hidden />
                Monitorado por CNPJ
                <TrackingStatusBadge tracking={cnpjTracking} />
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
          value={formatNumber(judit?.total ?? lawsuits.length)}
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
                    <TrackingStatusBadge tracking={t} />
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
            {!fromJudit
              ? "Selecione um processo para ver detalhes e movimentações."
              : judit
                ? `${QUERY_MODES.datalake_sync.label} à JUDIT feita em ${formatDateTime(judit.fetchedAt)}${supportView && judit.requestId ? ` · request_id ${judit.requestId}` : ""}. Os processos não ficam salvos: recarregar a página limpa a lista (a consulta fica no histórico, em Consultas).`
                : "Os processos vêm de uma consulta síncrona à JUDIT. Cada consulta é cobrada."}
          </CardDescription>
          <CardAction className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground tabular-nums">
              {formatNumber(lawsuits.length)} processos
            </span>
            {fromJudit && (
              <Button
                variant="outline"
                size="sm"
                onClick={searchJudit}
                disabled={searching}
              >
                {searching ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <CloudDownloadIcon data-icon="inline-start" />
                )}
                Fazer {QUERY_MODES.datalake_sync.label.toLowerCase()}
              </Button>
            )}
          </CardAction>
        </CardHeader>
        <CardContent>
          {judit && judit.total > judit.lawsuits.length && (
            <p className="mb-3 text-sm text-muted-foreground">
              Mostrando {formatNumber(judit.lawsuits.length)} de{" "}
              {formatNumber(judit.total)} processos: a consulta síncrona devolve
              tudo de uma vez, e a tela mostra só os primeiros para não travar.
            </p>
          )}
          <LawsuitsTable
            lawsuits={lawsuits}
            onSelect={setSelected}
            emptyDescription={
              fromJudit
                ? judit
                  ? "A consulta síncrona não retornou processos para este CNPJ."
                  : "Clique em “Fazer consulta síncrona” para buscar os processos."
                : undefined
            }
          />
        </CardContent>
      </Card>

      {fromJudit && (
        <AsyncQueriesCard
          cnpj={company.cnpj}
          queries={asyncQueries}
          onSelectLawsuit={setSelected}
        />
      )}

      <LawsuitSheet
        lawsuit={selected}
        onOpenChange={(open) => !open && setSelected(null)}
      />
    </>
  );
}
