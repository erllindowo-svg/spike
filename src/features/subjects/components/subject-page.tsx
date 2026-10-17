"use client";

import { RadarIcon, SearchIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { SearchType, TrackingSearchType } from "@/lib/models";
import { unreadAlertsByCnj } from "@/features/alerts/links";
import { featuresFor, trackingFor } from "@/features/consult/catalog";
import { formatSearchKey, SEARCH_TYPES } from "@/features/consult/identify";
import { LawsuitSheet } from "@/features/processes/components/lawsuit-sheet";
import type { Lawsuit } from "@/features/processes/types";
import type { QueryView } from "@/features/queries/types";
import { useNewTrackingDialog } from "@/features/trackings/components/new-tracking-dialog";
import { TrackingsTable } from "@/features/trackings/components/trackings-table";
import { useDemoStore } from "@/lib/demo-store";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

import { AskHere } from "./ask-here";
import type { SubjectView } from "../view";
import {
  Known,
  lastFetch,
  LawsuitsBody,
  QueriesTable,
  RegistrationsList,
  StatsBody,
  WarrantsList,
} from "./subject-sections";

// Ficha de um assunto (círculo 3, fatia 6): tudo o que o app sabe de um
// identificador. Lê o banco (base própria, histórico, monitoramentos,
// alertas); não consulta a JUDIT ao abrir. Desde o círculo 5, as perguntas
// que faltam se consultam aqui mesmo (ask-here.tsx), e o monitoramento se
// cria aqui, com o diálogo de sempre. Desde o círculo 7, os alertas não têm
// cartão próprio: o processo com alerta não lido ganha a marca azul na lista
// de processos, e abri-lo marca o alerta como lido. O menu do sino chega
// aqui com ?processo=<cnj>, que abre o processo no painel lateral.

// Como os resultados do monitoramento chegam (círculo 3, fatia 8).
function deliveryText(trackings: { delivery: "polling" | "webhook" }[]) {
  return trackings.some((t) => t.delivery === "webhook")
    ? "Os resultados chegam sozinhos, por webhook, e viram alertas."
    : "Os resultados não chegam sozinhos (sem webhook): veja em “Ver resultados”.";
}

export function SubjectPage({
  searchType,
  searchKey,
  view,
  queries,
}: {
  searchType: SearchType;
  searchKey: string;
  view: SubjectView;
  queries: QueryView[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { parties, trackings, alerts, markAlertRead } = useDemoStore();
  const { openNewTracking } = useNewTrackingDialog();
  const [selected, setSelected] = useState<Lawsuit | null>(null);

  const party =
    searchType === "cpf" || searchType === "cnpj"
      ? parties.find(
          (p) => p.documentType === searchType && p.document === searchKey,
        )
      : undefined;
  const registration = view.registrations.find(
    (r) => r.documentType === searchType && r.document === searchKey,
  );
  const name =
    party?.name ??
    registration?.name ??
    (searchType === "name" ? searchKey : null);
  const key = formatSearchKey(searchType, searchKey);
  const consultHref = `/?valor=${encodeURIComponent(searchKey)}&tipo=${searchType}`;

  const ownTrackings = trackings.filter(
    (t) =>
      t.searchType === searchType &&
      t.searchKey === searchKey &&
      t.status !== "deleted",
  );
  const trackingIds = new Set(ownTrackings.map((t) => t.id));
  // Alertas não lidos deste assunto, por processo: a marca azul na lista.
  const unreadByCnj = unreadAlertsByCnj(alerts, trackingIds);
  const highlighted = new Set(unreadByCnj.keys());

  // O processo aberto: o clicado na lista ou, vindo do menu do sino, o do
  // ?processo=. Sem o processo guardado na ficha, o painel não abre.
  const cnjFromUrl = searchParams.get("processo");
  const fromUrl = cnjFromUrl
    ? (view.lawsuits.find((l) => l.cnj === cnjFromUrl) ?? null)
    : null;
  const shown = selected ?? fromUrl;

  const lawsuits = view.lawsuits.filter((l) => l.kind === "lawsuit");
  const executions = view.lawsuits.filter((l) => l.kind === "execution");
  const count = view.stats.find((s) => s.mode === "datalake_count");
  const synthetic = view.stats.find((s) => s.mode === "datalake_synthetic");
  const lastLawsuitFetch = lastFetch(view.lawsuits);

  const askedModes = new Set(queries.map((q) => q.mode));
  const notAsked = featuresFor(searchType).filter(
    (f) => !askedModes.has(f.mode),
  );
  const canTrack = featuresFor(searchType).some(
    (f) => !!trackingFor(f.id, searchType),
  );

  function openLawsuit(lawsuit: Lawsuit) {
    setSelected(lawsuit);
    for (const id of unreadByCnj.get(lawsuit.cnj) ?? []) markAlertRead(id);
  }

  function closeLawsuit() {
    setSelected(null);
    // Fechar tira o ?processo= da URL, para o F5 não reabrir o painel.
    if (cnjFromUrl) router.replace(pathname, { scroll: false });
  }

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex h-5 items-center rounded-md border bg-muted/50 px-1.5 font-mono text-[11px] font-medium">
              {SEARCH_TYPES[searchType].label}
            </span>
            {SEARCH_TYPES[searchType].description}
          </span>
          <h2 className="truncate font-heading text-xl font-semibold tracking-tight">
            {name ?? key}
          </h2>
          {name && searchType !== "name" && (
            <p className="font-mono text-sm text-muted-foreground">{key}</p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href={consultHref} />}
          >
            <SearchIcon data-icon="inline-start" />
            Consultar
          </Button>
        </div>
      </div>

      <Card className={cn(ownTrackings.length > 0 && "gap-0 pb-0")}>
        <CardHeader>
          <CardTitle>Monitoramento</CardTitle>
          <CardDescription>
            {ownTrackings.length > 0
              ? `Pausar, reativar, ver resultados ou excluir: no menu de cada linha. ${deliveryText(ownTrackings)}`
              : canTrack
                ? "Não monitorado."
                : "A JUDIT não monitora este tipo de identificador."}
          </CardDescription>
          {ownTrackings.length === 0 && canTrack && (
            <CardAction>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  openNewTracking({
                    searchType: searchType as TrackingSearchType,
                    searchKey,
                    locked: true,
                  })
                }
              >
                <RadarIcon data-icon="inline-start" />
                Monitorar
              </Button>
            </CardAction>
          )}
        </CardHeader>
        {ownTrackings.length > 0 && (
          <div className="pt-4">
            <TrackingsTable trackings={ownTrackings} />
          </div>
        )}
      </Card>

      {view.registrations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Dados cadastrais</CardTitle>
            <CardDescription>
              {view.registrations.length > 1
                ? `${view.registrations.length} cadastros encontrados (uma busca por nome traz homônimos).`
                : "Cadastro na Receita Federal, pela JUDIT."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <RegistrationsList registrations={view.registrations} />
          </CardContent>
        </Card>
      )}

      {(count || synthetic) && (
        <Card>
          <CardHeader>
            <CardTitle>Números</CardTitle>
            <CardDescription>
              {synthetic ? (
                <Known
                  fetchedAt={synthetic.fetchedAt}
                  origin={synthetic.origin}
                />
              ) : (
                count && (
                  <Known fetchedAt={count.fetchedAt} origin={count.origin} />
                )
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <StatsBody count={count} synthetic={synthetic} />
          </CardContent>
        </Card>
      )}

      {(lawsuits.length > 0 || searchType !== "rji") && (
        <Card>
          <CardHeader>
            <CardTitle>Processos</CardTitle>
            <CardDescription>
              {lawsuits.length === 0 ? (
                "Nenhum processo guardado. Consulte a lista de processos na página Consultar."
              ) : (
                <>
                  {formatNumber(lawsuits.length)} guardados.{" "}
                  {lastLawsuitFetch && (
                    <Known fetchedAt={lastLawsuitFetch} origin={null} />
                  )}
                </>
              )}
            </CardDescription>
          </CardHeader>
          {lawsuits.length > 0 && (
            <CardContent className="flex flex-col gap-3">
              <LawsuitsBody
                lawsuits={lawsuits}
                onSelect={openLawsuit}
                highlighted={highlighted}
              />
            </CardContent>
          )}
        </Card>
      )}

      {executions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Execuções penais</CardTitle>
          </CardHeader>
          <CardContent>
            <LawsuitsBody
              lawsuits={executions}
              onSelect={openLawsuit}
              highlighted={highlighted}
            />
          </CardContent>
        </Card>
      )}

      {view.warrants.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Mandados de prisão</CardTitle>
          </CardHeader>
          <CardContent>
            <WarrantsList warrants={view.warrants} />
          </CardContent>
        </Card>
      )}

      <Card className="gap-0 pb-0">
        <CardHeader className="pb-4">
          <CardTitle>Consultas feitas</CardTitle>
          <CardDescription>
            {queries.length === 0
              ? "Nenhuma consulta registrada para este identificador."
              : "Do mais novo para o mais antigo. As assíncronas se acompanham daqui."}
          </CardDescription>
        </CardHeader>
        {queries.length > 0 && <QueriesTable queries={queries} />}
      </Card>

      {notAsked.length > 0 && (
        <AskHere
          searchType={searchType}
          searchKey={searchKey}
          features={notAsked}
          consultHref={consultHref}
        />
      )}

      <LawsuitSheet
        lawsuit={shown}
        onOpenChange={(open) => !open && closeLawsuit()}
        readOnly
      />
    </>
  );
}
