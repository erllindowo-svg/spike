"use client";

import {
  ArrowRightIcon,
  BellIcon,
  BellOffIcon,
  Building2Icon,
  FileSearchIcon,
  PlusIcon,
  RadarIcon,
  SearchIcon,
} from "lucide-react";
import Link from "next/link";

import { ColumnChart } from "@/components/shared/column-chart";
import { DistributionChart } from "@/components/shared/distribution-chart";
import { PageIntro } from "@/components/shared/page-intro";
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
import { alertTypeStyles } from "@/features/alerts/components/alerts-center";
import {
  DistributionCard,
  type DistributionData,
} from "@/features/processes/components/distribution-card";
import { isQueryOpen, type QueryView } from "@/features/queries/types";
import { SupportOnly, useSupportView } from "@/features/settings/support-view";
import { useNewTrackingDialog } from "@/features/trackings/components/new-tracking-dialog";
import { TrackingsTable } from "@/features/trackings/components/trackings-table";
import {
  getTrackingDisplayState,
  isTrackingClosed,
} from "@/features/trackings/types";
import { countByStatus } from "@/features/webhooks/stats";
import { useDemoStore } from "@/lib/demo-store";
import { formatDate, formatNumber, formatShortDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

import {
  countPerDay,
  countQueriesByMode,
  countTrackingsByState,
} from "../stats";

// Dashboard (círculo 1 do escopo, C1-8): um resumo de todas as áreas. Tudo
// vem do que o app já guardou; abrir esta página não chama a JUDIT.

const ALERT_DAYS = 14;

export function OverviewDashboard({
  queries,
  referenceDate,
  lawsuitsCount,
  distribution,
}: {
  queries: QueryView[];
  // Fim do período dos gráficos ("hoje"), vindo do servidor.
  referenceDate: Date;
  lawsuitsCount: number;
  distribution: DistributionData;
}) {
  const { companies, trackings, alerts } = useDemoStore();
  const { openNewTracking } = useNewTrackingDialog();
  const [supportView] = useSupportView();

  const activeTrackings = trackings.filter(
    (t) => getTrackingDisplayState(t) === "active",
  ).length;
  const companiesWithTracking = new Set(
    trackings
      .filter((t) => t.searchType === "cnpj" && !isTrackingClosed(t))
      .map((t) => t.searchKey),
  ).size;
  const unread = alerts
    .filter((a) => !a.readAt)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const alertDays = countPerDay(
    alerts.map((a) => a.createdAt),
    referenceDate,
    ALERT_DAYS,
  );
  const alertsInPeriod = alertDays.reduce((sum, d) => sum + d.count, 0);
  const openQueries = queries.filter(isQueryOpen).length;

  return (
    <>
      <PageIntro description="Resumo do que o app acompanha: empresas, monitoramentos, alertas e consultas.">
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href="/empresas" />}
        >
          <SearchIcon data-icon="inline-start" />
          Pesquisar empresa
        </Button>
        <Button onClick={() => openNewTracking()}>
          <PlusIcon data-icon="inline-start" />
          Novo monitoramento
        </Button>
      </PageIntro>

      <section
        aria-label="Indicadores"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <StatCard
          label="Empresas"
          value={formatNumber(companies.length)}
          hint={plural(
            companiesWithTracking,
            "monitorada por CNPJ",
            "monitoradas por CNPJ",
          )}
          icon={Building2Icon}
        />
        <StatCard
          label="Monitoramentos ativos"
          value={formatNumber(activeTrackings)}
          hint={`de ${trackings.length} cadastrados`}
          icon={RadarIcon}
        />
        <StatCard
          label="Alertas não lidos"
          value={formatNumber(unread.length)}
          hint={`${formatNumber(alertsInPeriod)} nos últimos ${ALERT_DAYS} dias`}
          icon={BellIcon}
        />
        <StatCard
          label="Consultas"
          value={formatNumber(queries.length)}
          hint={
            openQueries
              ? plural(
                  openQueries,
                  "assíncrona em andamento",
                  "assíncronas em andamento",
                )
              : "Nenhuma em andamento"
          }
          icon={FileSearchIcon}
        />
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>O que chegou</CardTitle>
            <CardDescription>Alertas ainda não lidos.</CardDescription>
            <CardAction>
              <SeeAll href="/monitoramentos/alertas" label="Alertas" />
            </CardAction>
          </CardHeader>
          <CardContent>
            {unread.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-6 text-center text-sm text-muted-foreground">
                <BellOffIcon className="size-5" aria-hidden />
                Tudo em dia: nenhum alerta não lido.
              </div>
            ) : (
              <ul className="flex flex-col divide-y">
                {unread.slice(0, 5).map((alert) => {
                  const { icon: Icon, className } = alertTypeStyles[alert.type];
                  const company = companies.find(
                    (c) => c.id === alert.companyId,
                  );
                  return (
                    <li key={alert.id}>
                      <Link
                        href={
                          alert.trackingId
                            ? `/monitoramentos/alertas?monitoramento=${alert.trackingId}`
                            : "/monitoramentos/alertas"
                        }
                        className="flex items-start gap-3 rounded-md py-2.5 outline-none hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring/50"
                      >
                        <span
                          className={cn(
                            "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full",
                            className,
                          )}
                        >
                          <Icon className="size-3.5" aria-hidden />
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-sm font-medium">
                            {alert.title}
                          </span>
                          <span className="truncate text-xs text-muted-foreground">
                            {company?.legalName ?? alert.description}
                          </span>
                        </span>
                        <time
                          dateTime={alert.createdAt.toISOString()}
                          className="shrink-0 text-xs text-muted-foreground tabular-nums"
                        >
                          {formatShortDateTime(alert.createdAt)}
                        </time>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
            {unread.length > 5 && (
              <p className="mt-2 text-xs text-muted-foreground">
                E mais {unread.length - 5} na aba Alertas.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Alertas por dia</CardTitle>
            <CardDescription>
              Últimos {ALERT_DAYS} dias, até {formatDate(referenceDate)}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ColumnChart
              data={alertDays.map((d) => ({
                key: d.key,
                label: d.label,
                value: d.count,
              }))}
              label={`Alertas por dia nos últimos ${ALERT_DAYS} dias`}
              unit="alertas"
            />
          </CardContent>
        </Card>
      </div>

      {/* Três colunas só quando o cartão de suporte aparece. */}
      <div
        className={cn(
          "grid grid-cols-1 gap-4 lg:grid-cols-2",
          supportView && "xl:grid-cols-3",
        )}
      >
        <Card>
          <CardHeader>
            <CardTitle>Monitoramentos por situação</CardTitle>
            <CardDescription>Todos os cadastrados.</CardDescription>
            <CardAction>
              <SeeAll href="/monitoramentos" label="Ver todos" />
            </CardAction>
          </CardHeader>
          <CardContent>
            <DistributionChart
              data={countTrackingsByState(trackings)}
              label="situação"
              unit="monitoramentos"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Consultas por modalidade</CardTitle>
            <CardDescription>Síncronas e assíncronas.</CardDescription>
            <CardAction>
              <SeeAll href="/consultas" label="Ver todas" />
            </CardAction>
          </CardHeader>
          <CardContent>
            <DistributionChart
              data={countQueriesByMode(queries)}
              label="modalidade"
              unit="consultas"
            />
          </CardContent>
        </Card>

        <SupportOnly>
          <WebhookProcessingCard />
        </SupportOnly>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className={lawsuitsCount > 0 ? "lg:col-span-3" : "lg:col-span-5"}>
          <CardHeader>
            <CardTitle>Monitoramentos recentes</CardTitle>
            <CardDescription>
              Últimos monitoramentos atualizados.
            </CardDescription>
            <CardAction>
              <SeeAll href="/monitoramentos" label="Ver todos" />
            </CardAction>
          </CardHeader>
          <CardContent className="px-2">
            <TrackingsTable
              trackings={[...trackings]
                .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
                .slice(0, 5)}
              variant="compact"
            />
          </CardContent>
        </Card>

        {/* Processos só ficam guardados na demonstração; no modo "db" eles
            são lidos da JUDIT na página de cada empresa. */}
        {lawsuitsCount > 0 && (
          <DistributionCard
            data={distribution}
            className="lg:col-span-2"
            description="Processos encontrados, por agrupamento."
          />
        )}
      </div>
    </>
  );
}

function plural(count: number, one: string, many: string): string {
  return `${formatNumber(count)} ${count === 1 ? one : many}`;
}

function SeeAll({ href, label }: { href: string; label: string }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      nativeButton={false}
      render={<Link href={href} />}
    >
      {label}
      <ArrowRightIcon data-icon="inline-end" />
    </Button>
  );
}

// Só na vista de suporte: a saúde do recebimento de webhooks.
function WebhookProcessingCard() {
  const { webhookEvents } = useDemoStore();
  const counts = countByStatus(webhookEvents);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Processamento de webhooks</CardTitle>
        <CardDescription>Situação dos eventos recebidos.</CardDescription>
        <CardAction>
          <SeeAll href="/webhooks" label="Diagnóstico" />
        </CardAction>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-3">
          {(
            [
              ["Processados", counts.processed, "text-success"],
              [
                "Aguardando processamento",
                counts.pending + counts.processing,
                "text-warning",
              ],
              ["Com falha", counts.failed, "text-destructive"],
              ["Ignorados", counts.ignored, "text-muted-foreground"],
            ] as const
          ).map(([label, value, color]) => (
            <div key={label} className="rounded-lg border bg-muted/30 p-3">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd
                className={`mt-1 text-xl font-semibold tabular-nums ${color}`}
              >
                {formatNumber(value)}
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
