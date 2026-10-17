"use client";

import {
  CheckIcon,
  LockIcon,
  RadarIcon,
  SearchIcon,
  SparklesIcon,
  Trash2Icon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { DistributionChart } from "@/components/shared/distribution-chart";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { RecordOrigin, SearchType } from "@/db/models";
import { alertTypeStyles } from "@/features/alerts/components/alert-type-styles";
import { featuresFor, trackingFor } from "@/features/consult/catalog";
import { formatSearchKey, SEARCH_TYPES } from "@/features/consult/identify";
import { LawsuitSheet } from "@/features/processes/components/lawsuit-sheet";
import { LawsuitsTable } from "@/features/processes/components/lawsuits-table";
import type { Lawsuit } from "@/features/processes/types";
import { QUERY_MODES } from "@/features/queries/modes";
import {
  QueryResult,
  RequestIdCell,
} from "@/features/queries/components/query-cells";
import type { QueryView } from "@/features/queries/types";
import { SupportOnly } from "@/features/settings/support-view";
import { TrackingsTable } from "@/features/trackings/components/trackings-table";
import { SERVER_UNREACHABLE, useDemoStore } from "@/lib/demo-store";
import {
  formatDateTime,
  formatNumber,
  formatShortDateTime,
} from "@/lib/format";
import { cn } from "@/lib/utils";

import { deleteSubjectAction } from "../actions";
import type { SubjectView } from "../view";

// Ficha de um assunto (círculo 3, fatia 6): tudo o que o app sabe de um
// identificador. Lê o banco (base própria, histórico, monitoramentos,
// alertas); não consulta a JUDIT ao abrir. As ações que ficam aqui cuidam
// do que já existe (monitoramento, alerta lido, apagar); pedir algo novo é
// na página Consultar, por link.

const originLabels: Record<RecordOrigin, string> = {
  sync: "consulta síncrona",
  async: "consulta assíncrona",
  tracking: "monitoramento",
  webhook: "entrega por webhook",
};

function Known({
  fetchedAt,
  origin,
}: {
  fetchedAt: Date | null;
  origin: RecordOrigin | null;
}) {
  if (!fetchedAt) {
    return <span>Dados fictícios da demonstração.</span>;
  }
  return (
    <span>
      Consultado em {formatDateTime(fetchedAt)}
      {origin && ` (${originLabels[origin]})`}.
    </span>
  );
}

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
  const {
    parties,
    trackings,
    alerts,
    markAlertRead,
    markAllAlertsRead,
    dataSource,
  } = useDemoStore();
  const [selected, setSelected] = useState<Lawsuit | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [deleting, startDelete] = useTransition();

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
  const ownAlerts = alerts
    .filter((a) => a.trackingId && trackingIds.has(a.trackingId))
    .sort(
      (a, b) =>
        Number(!!a.readAt) - Number(!!b.readAt) ||
        b.createdAt.getTime() - a.createdAt.getTime(),
    );

  const lawsuits = view.lawsuits.filter((l) => l.kind === "lawsuit");
  const executions = view.lawsuits.filter((l) => l.kind === "execution");
  const secret = view.lawsuits.filter((l) => (l.secrecyLevel ?? 0) > 0).length;
  const aiSummary = view.lawsuits.find((l) => l.aiSummary)?.aiSummary ?? null;
  const count = view.stats.find((s) => s.mode === "datalake_count");
  const synthetic = view.stats.find((s) => s.mode === "datalake_synthetic");
  const lastLawsuitFetch = view.lawsuits
    .map((l) => l.fetchedAt)
    .filter((d): d is Date => !!d)
    .sort((a, b) => b.getTime() - a.getTime())[0];

  const askedModes = new Set(queries.map((q) => q.mode));
  const notAsked = featuresFor(searchType).filter(
    (f) => !askedModes.has(f.mode),
  );
  const canTrack = featuresFor(searchType).some(
    (f) => !!trackingFor(f.id, searchType),
  );

  function remove() {
    startDelete(async () => {
      try {
        const result = await deleteSubjectAction({ searchType, searchKey });
        if (!result.ok) {
          toast.error("Assunto não apagado", { description: result.message });
          return;
        }
        toast.success("Assunto apagado", { description: result.message });
        setConfirming(false);
        router.push("/informacoes");
      } catch {
        toast.error(SERVER_UNREACHABLE);
      }
    });
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
          {dataSource === "db" && (
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => setConfirming(true)}
            >
              <Trash2Icon data-icon="inline-start" />
              Apagar este assunto
            </Button>
          )}
        </div>
      </div>

      {ownAlerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Alertas</CardTitle>
            <CardDescription>
              Avisos dos monitoramentos deste assunto, os não lidos primeiro.
            </CardDescription>
            {ownAlerts.some((a) => !a.readAt) && (
              <CardAction>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    for (const tracking of ownTrackings) {
                      const error = await markAllAlertsRead(tracking.id);
                      if (error) {
                        toast.error(error);
                        return;
                      }
                    }
                  }}
                >
                  <CheckIcon data-icon="inline-start" />
                  Marcar todos como lidos
                </Button>
              </CardAction>
            )}
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col divide-y">
              {ownAlerts.slice(0, 20).map((alert) => {
                const { icon: Icon, className } = alertTypeStyles[alert.type];
                return (
                  <li key={alert.id} className="flex items-start gap-3 py-2.5">
                    <span
                      className={cn(
                        "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full",
                        className,
                      )}
                    >
                      <Icon className="size-3.5" aria-hidden />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span
                        className={cn(
                          "text-sm",
                          !alert.readAt && "font-medium",
                        )}
                      >
                        {alert.title}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {alert.description}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <time
                        dateTime={alert.createdAt.toISOString()}
                        className="text-xs text-muted-foreground tabular-nums"
                      >
                        {formatShortDateTime(alert.createdAt)}
                      </time>
                      {!alert.readAt && (
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => markAlertRead(alert.id)}
                        >
                          <CheckIcon data-icon="inline-start" />
                          Marcar como lido
                        </Button>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card className={cn(ownTrackings.length > 0 && "gap-0 pb-0")}>
        <CardHeader>
          <CardTitle>Monitoramento</CardTitle>
          <CardDescription>
            {ownTrackings.length > 0
              ? `Pausar, reativar, ver resultados ou excluir: no menu de cada linha. ${deliveryText(ownTrackings)}`
              : canTrack
                ? "Não monitorado. Para monitorar, use a página Consultar."
                : "A JUDIT não monitora este tipo de identificador."}
          </CardDescription>
          {ownTrackings.length === 0 && canTrack && (
            <CardAction>
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={<Link href={consultHref} />}
              >
                <RadarIcon data-icon="inline-start" />
                Ir para Consultar
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
            {view.registrations.map((r) => (
              <dl
                key={`${r.documentType}:${r.document}`}
                className="grid grid-cols-[10rem_1fr] gap-x-3 gap-y-1.5 text-sm"
              >
                <dt className="text-muted-foreground">Nome</dt>
                <dd>{r.name ?? "Não informado"}</dd>
                <dt className="text-muted-foreground">
                  {SEARCH_TYPES[r.documentType].label}
                </dt>
                <dd className="font-mono">
                  {formatSearchKey(r.documentType, r.document)}
                </dd>
                {r.tradeName && (
                  <>
                    <dt className="text-muted-foreground">Nome fantasia</dt>
                    <dd>{r.tradeName}</dd>
                  </>
                )}
                <dt className="text-muted-foreground">Situação</dt>
                <dd>{r.registrationStatus ?? "Não informada"}</dd>
                {r.specialStatus && (
                  <>
                    <dt className="text-muted-foreground">Situação especial</dt>
                    <dd>{r.specialStatus}</dd>
                  </>
                )}
                <dd className="col-span-2 text-xs text-muted-foreground">
                  <Known fetchedAt={r.fetchedAt} origin={r.origin} />
                </dd>
              </dl>
            ))}
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
            {(synthetic?.total ?? count?.total) !== null && (
              <p className="flex items-baseline gap-2">
                <span className="font-heading text-3xl font-semibold tabular-nums">
                  {formatNumber((synthetic?.total ?? count?.total) as number)}
                </span>
                <span className="text-muted-foreground">
                  processos na base da JUDIT
                </span>
              </p>
            )}
            {synthetic && synthetic.groups.length > 0 && (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {synthetic.groups.map((group) => (
                  <section key={group.title} className="flex flex-col gap-2">
                    <h3 className="text-sm font-medium">{group.title}</h3>
                    <DistributionChart data={group.data} label={group.title} />
                  </section>
                ))}
              </div>
            )}
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
              {secret > 0 && (
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <LockIcon className="size-3.5" aria-hidden />
                  {secret === 1
                    ? "1 processo em segredo de justiça: a JUDIT devolve quase tudo vazio."
                    : `${secret} processos em segredo de justiça: a JUDIT devolve quase tudo vazio.`}
                </p>
              )}
              {aiSummary && (
                <section className="flex flex-col gap-1.5 rounded-lg border bg-muted/30 p-3">
                  <h3 className="flex items-center gap-1.5 text-sm font-medium">
                    <SparklesIcon className="size-4" aria-hidden />
                    Resumo escrito pela IA da JUDIT (beta)
                  </h3>
                  <p className="text-sm whitespace-pre-line">{aiSummary}</p>
                </section>
              )}
              <LawsuitsTable
                lawsuits={lawsuits}
                onSelect={setSelected}
                emptyDescription="Nenhum processo guardado."
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
            <LawsuitsTable
              lawsuits={executions}
              onSelect={setSelected}
              emptyDescription="Nenhuma execução penal guardada."
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
            <ul className="flex flex-col divide-y text-sm">
              {view.warrants.map((w) => (
                <li
                  key={w.code ?? w.number}
                  className="flex flex-col gap-0.5 py-2.5"
                >
                  <span className="font-medium">
                    {w.warrantType ?? "Mandado"}
                    {w.status && (
                      <StatusBadge tone="warning" className="ml-2">
                        {w.status}
                      </StatusBadge>
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {[w.number, w.issueDate && `expedido em ${w.issueDate}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                  {w.judgementSummary && (
                    <span className="text-xs">{w.judgementSummary}</span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    <Known fetchedAt={w.fetchedAt} origin={w.origin} />
                  </span>
                </li>
              ))}
            </ul>
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
        {queries.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Quando</TableHead>
                <TableHead>Consulta</TableHead>
                <TableHead>Resultado</TableHead>
                <SupportOnly>
                  <TableHead>request_id</TableHead>
                </SupportOnly>
              </TableRow>
            </TableHeader>
            <TableBody>
              {queries.map((q) => (
                <TableRow key={q.id}>
                  <TableCell className="pl-4 whitespace-nowrap tabular-nums">
                    {formatDateTime(q.createdAt)}
                  </TableCell>
                  <TableCell>{QUERY_MODES[q.mode].label}</TableCell>
                  <TableCell>
                    <QueryResult query={q} />
                  </TableCell>
                  <SupportOnly>
                    <TableCell>
                      <RequestIdCell query={q} />
                    </TableCell>
                  </SupportOnly>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {notAsked.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>O que ainda não se sabe</CardTitle>
            <CardDescription>
              Perguntas que a JUDIT responde para este identificador e que ainda
              não foram feitas. Cada uma abre a página Consultar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-wrap gap-2">
              {notAsked.map((f) => (
                <li key={f.id}>
                  <Button
                    variant="outline"
                    size="sm"
                    nativeButton={false}
                    render={<Link href={consultHref} />}
                  >
                    {f.question}
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <LawsuitSheet
        lawsuit={selected}
        onOpenChange={(open) => !open && setSelected(null)}
        readOnly
      />

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apagar este assunto?</DialogTitle>
            <DialogDescription>
              Sai do banco do app: os dados guardados que só este assunto
              encontrou, o histórico de consultas dele e a parte salva (se não
              houver monitoramento). Processos encontrados também por outro
              assunto continuam. Não muda nada na JUDIT, e não dá para desfazer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={remove} disabled={deleting}>
              {deleting && <Spinner data-icon="inline-start" />}
              Apagar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
