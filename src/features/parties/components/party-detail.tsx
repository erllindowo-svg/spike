"use client";

import {
  BellIcon,
  CalendarClockIcon,
  CheckCircle2Icon,
  CloudDownloadIcon,
  FileTextIcon,
  IdCardIcon,
  LandmarkIcon,
  RadarIcon,
  ScaleIcon,
} from "lucide-react";
import Link from "next/link";
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
import { DOCUMENTS, formatDocument } from "@/features/parties/documents";
import type { Party } from "@/features/parties/types";
import type { JuditRequest } from "@/db/models";
import {
  DistributionCard,
  type DistributionData,
} from "@/features/processes/components/distribution-card";
import { LawsuitSheet } from "@/features/processes/components/lawsuit-sheet";
import { LawsuitsTable } from "@/features/processes/components/lawsuits-table";
import {
  searchPartyLawsuitsAction,
  type SearchPartyLawsuitsResult,
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

type JuditSearch = Extract<SearchPartyLawsuitsResult, { ok: true }>;

export function PartyDetail({
  party,
  lawsuits: demoLawsuits,
  asyncQueries,
  distribution: demoDistribution,
}: {
  party: Party;
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
  const info = DOCUMENTS[party.documentType];
  const isCompany = party.documentType === "cnpj";
  const ref = { documentType: party.documentType, document: party.document };
  // Na página da pessoa, o pronome muda: "desta empresa" / "desta pessoa".
  const ofThis = isCompany ? "desta empresa" : "desta pessoa";

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
      const result = await searchPartyLawsuitsAction(ref);
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

  // Dados cadastrais (POST /entities, cobrada): nome e situação. O resultado
  // é gravado na parte e chega pela nova renderização (refresh()).
  function refreshRegistration() {
    startRefresh(async () => {
      let result;
      try {
        result = await refreshRegistrationDataAction(ref);
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
          description: result.registration.name ?? undefined,
        });
      } else {
        toast.warning(
          `A JUDIT não encontrou cadastro para este ${info.label}.`,
        );
      }
    });
  }

  const lawsuitCnjs = new Set(lawsuits.map((l) => l.cnj));
  const linkedTrackings = trackings.filter(
    (t) =>
      t.partyId === party.id ||
      (t.searchType === party.documentType && t.searchKey === party.document) ||
      (t.searchType === "cnj" && lawsuitCnjs.has(t.searchKey)),
  );
  const documentTracking = linkedTrackings.find(
    (t) => t.searchType === party.documentType && !isTrackingClosed(t),
  );
  const partyActivity = activity.filter((a) => a.partyId === party.id);
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
                {party.name ?? (
                  <span className="text-muted-foreground">
                    {isCompany
                      ? "Razão social não consultada"
                      : "Nome não consultado"}
                  </span>
                )}
              </h2>
              <RegistrationStatusBadge status={party.registrationStatus} />
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="font-mono text-foreground">
                {info.label}{" "}
                {formatDocument(party.documentType, party.document)}
              </span>
              {party.tradeName && <span>Nome fantasia: {party.tradeName}</span>}
              <span>Adicionada em {formatDate(party.createdAt)}</span>
              {!party.name && (
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
                title="Consulta cobrada: nome e situação na Receita"
              >
                {refreshing ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <IdCardIcon data-icon="inline-start" />
                )}
                {party.name
                  ? "Atualizar dados cadastrais"
                  : "Consultar dados cadastrais"}
              </Button>
            )}
            <CopyButton
              value={party.document}
              label={`Copiar ${info.label}`}
              successMessage={`${info.label} copiado.`}
            />
            {documentTracking ? (
              <span className="inline-flex h-8 items-center gap-2 rounded-lg border px-2.5 text-sm">
                <CheckCircle2Icon className="size-4 text-success" aria-hidden />
                Monitorado por {info.label}
                <TrackingStatusBadge tracking={documentTracking} />
              </span>
            ) : (
              <Button
                onClick={() =>
                  openNewTracking({
                    searchType: party.documentType,
                    searchKey: party.document,
                  })
                }
              >
                <RadarIcon data-icon="inline-start" />
                Monitorar {info.label}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <section
        aria-label={`Indicadores ${ofThis}`}
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
          description={`Processos ${ofThis} por agrupamento.`}
        />
        <Card>
          <CardHeader>
            <CardTitle>Monitoramentos vinculados</CardTitle>
            <CardDescription>
              {`Por ${info.label} e por processos ${isCompany ? "da empresa" : "da pessoa"}.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {linkedTrackings.length === 0 ? (
              <EmptyState
                icon={RadarIcon}
                title="Nenhum monitoramento"
                description={`Monitore o ${info.label} para ser avisado sobre novos processos.`}
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
        {/* No modo "db" a atividade não é gravada; os alertas, sim. */}
        <Card className="lg:col-span-2 xl:col-span-1">
          <CardHeader>
            <CardTitle>
              {fromJudit ? "Alertas recentes" : "Atividade recente"}
            </CardTitle>
            <CardDescription>
              {fromJudit
                ? `Avisos dos monitoramentos ${ofThis}.`
                : `Eventos relacionados ${isCompany ? "a esta empresa" : "a esta pessoa"}.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {fromJudit ? (
              <PartyAlerts partyId={party.id} />
            ) : (
              <ActivityFeed items={partyActivity} limit={5} />
            )}
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
                  ? `A consulta síncrona não retornou processos para este ${info.label}.`
                  : "Clique em “Fazer consulta síncrona” para buscar os processos."
                : undefined
            }
          />
        </CardContent>
      </Card>

      {fromJudit && (
        <AsyncQueriesCard
          party={ref}
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

function PartyAlerts({ partyId }: { partyId: string }) {
  const { alerts } = useDemoStore();
  const partyAlerts = alerts
    .filter((a) => a.partyId === partyId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 5);

  if (partyAlerts.length === 0) {
    return (
      <EmptyState
        icon={BellIcon}
        title="Nenhum alerta"
        description="Os avisos dos monitoramentos aparecem aqui."
        className="py-6"
      />
    );
  }
  return (
    <ul className="flex flex-col divide-y text-sm">
      {partyAlerts.map((alert) => (
        <li key={alert.id} className="flex flex-col gap-0.5 py-2 first:pt-0">
          <Link
            href={
              alert.trackingId
                ? `/monitoramentos/alertas?monitoramento=${alert.trackingId}`
                : "/monitoramentos/alertas"
            }
            className={`underline-offset-4 hover:text-primary hover:underline ${alert.readAt ? "" : "font-medium"}`}
          >
            {alert.title}
          </Link>
          <span className="text-xs text-muted-foreground">
            {formatDateTime(alert.createdAt)}
          </span>
        </li>
      ))}
    </ul>
  );
}
