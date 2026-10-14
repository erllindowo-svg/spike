"use client";

import {
  ArrowRightIcon,
  Building2Icon,
  PlusIcon,
  RadarIcon,
  ScaleIcon,
  SearchIcon,
  WebhookIcon,
} from "lucide-react";
import Link from "next/link";

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
import { ActivityFeed } from "@/features/activity/components/activity-feed";
import {
  DistributionCard,
  type DistributionData,
} from "@/features/processes/components/distribution-card";
import { useNewTrackingDialog } from "@/features/trackings/components/new-tracking-dialog";
import { TrackingsTable } from "@/features/trackings/components/trackings-table";
import { getTrackingDisplayState } from "@/features/trackings/types";
import { countByStatus, getRecentEvents } from "@/features/webhooks/stats";
import { useDemoStore } from "@/lib/demo-store";
import { formatNumber } from "@/lib/format";

export function OverviewDashboard({
  distribution,
  lawsuitsCount,
  activeLawsuitsCount,
}: {
  distribution: DistributionData;
  lawsuitsCount: number;
  activeLawsuitsCount: number;
}) {
  const { companies, trackings, webhookEvents, activity } = useDemoStore();
  const { openNewTracking } = useNewTrackingDialog();

  const activeTrackings = trackings.filter(
    (t) => getTrackingDisplayState(t) === "active",
  ).length;
  const companiesWithTracking = new Set(
    trackings.filter((t) => t.searchType === "cnpj").map((t) => t.searchKey),
  ).size;
  const recentEvents = getRecentEvents(webhookEvents, 7);
  const recentCounts = countByStatus(recentEvents);
  const allCounts = countByStatus(webhookEvents);

  return (
    <>
      <PageIntro description="Panorama dos dados de demonstração: empresas consultadas, processos encontrados e o fluxo de eventos dos monitoramentos.">
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
          label="Empresas cadastradas"
          value={formatNumber(companies.length)}
          hint={`${companiesWithTracking} com monitoramento por CNPJ`}
          icon={Building2Icon}
        />
        <StatCard
          label="Processos encontrados"
          value={formatNumber(lawsuitsCount)}
          hint={`${activeLawsuitsCount} em andamento`}
          icon={ScaleIcon}
        />
        <StatCard
          label="Monitoramentos ativos"
          value={formatNumber(activeTrackings)}
          hint={`de ${trackings.length} cadastrados`}
          icon={RadarIcon}
        />
        <StatCard
          label="Eventos recebidos (7 dias)"
          value={formatNumber(recentEvents.length)}
          hint={
            recentCounts.failed
              ? `${recentCounts.failed} com falha de processamento`
              : "Nenhuma falha no período"
          }
          icon={WebhookIcon}
        />
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <DistributionCard
          data={distribution}
          className="lg:col-span-3"
          description="Processos encontrados nos dados de demonstração, por agrupamento."
        />
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Atividade recente</CardTitle>
            <CardDescription>
              Monitoramentos, eventos e alertas.
            </CardDescription>
            <CardAction>
              <Button
                variant="ghost"
                size="sm"
                nativeButton={false}
                render={<Link href="/alertas" />}
              >
                Alertas
                <ArrowRightIcon data-icon="inline-end" />
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <ActivityFeed items={activity} limit={6} />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Monitoramentos recentes</CardTitle>
            <CardDescription>
              Últimos monitoramentos atualizados.
            </CardDescription>
            <CardAction>
              <Button
                variant="ghost"
                size="sm"
                nativeButton={false}
                render={<Link href="/monitoramentos" />}
              >
                Ver todos
                <ArrowRightIcon data-icon="inline-end" />
              </Button>
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

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Processamento de webhooks</CardTitle>
            <CardDescription>
              Situação de todos os eventos recebidos.
            </CardDescription>
            <CardAction>
              <Button
                variant="ghost"
                size="sm"
                nativeButton={false}
                render={<Link href="/webhooks" />}
              >
                Diagnóstico
                <ArrowRightIcon data-icon="inline-end" />
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-3">
              {(
                [
                  ["Processados", allCounts.processed, "text-success"],
                  [
                    "Aguardando processamento",
                    allCounts.pending + allCounts.processing,
                    "text-warning",
                  ],
                  ["Com falha", allCounts.failed, "text-destructive"],
                  ["Ignorados", allCounts.ignored, "text-muted-foreground"],
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
      </div>
    </>
  );
}
