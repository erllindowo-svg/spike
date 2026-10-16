"use client";

import {
  BellIcon,
  Building2Icon,
  EllipsisIcon,
  PauseIcon,
  PlayIcon,
  ScaleIcon,
  WebhookIcon,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatHourRange,
  formatSearchKey,
  getLastEventByReference,
} from "@/features/trackings/format";
import {
  formatRecurrence,
  getTrackingDisplayState,
  searchTypeDescriptions,
  type Tracking,
} from "@/features/trackings/types";
import { useSupportView } from "@/features/settings/support-view";
import { partyHref } from "@/features/parties/documents";
import { useDemoStore } from "@/lib/demo-store";
import { formatDate, formatDateTime } from "@/lib/format";

import { SearchTypeBadge } from "./search-type-badge";
import {
  DeleteTrackingDialog,
  JuditTrackingMenuItems,
  TrackingResultsSheet,
  useTrackingResults,
} from "./tracking-judit-actions";
import { TrackingStatusBadge } from "./tracking-status-badge";

export function TrackingsTable({
  trackings,
  variant = "full",
}: {
  trackings: Tracking[];
  variant?: "full" | "compact";
}) {
  const {
    getParty,
    lawsuits,
    alerts,
    webhookEvents,
    setTrackingPaused,
    dataSource,
  } = useDemoStore();
  const [supportView] = useSupportView();
  const lastEvents = getLastEventByReference(webhookEvents);
  const alertCounts = countAlertsByTracking(alerts);
  const full = variant === "full";
  const [deleting, setDeleting] = useState<Tracking | null>(null);
  const trackingResults = useTrackingResults();

  function identifierHref(tracking: Tracking): string | null {
    if (tracking.searchType !== "cnj") {
      return tracking.partyId
        ? partyHref(tracking.searchType, tracking.searchKey)
        : null;
    }
    return lawsuits.some((l) => l.cnj === tracking.searchKey)
      ? `/processos/${tracking.searchKey}`
      : null;
  }

  function togglePause(tracking: Tracking, paused: boolean) {
    setTrackingPaused(tracking.id, paused);
    toast.success(paused ? "Monitoramento pausado" : "Monitoramento retomado", {
      description: "Alteração apenas local. Nenhuma chamada foi feita à JUDIT.",
    });
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {/* O que é monitorado: empresa, pessoa ou processo. */}
            <TableHead>Alvo</TableHead>
            <TableHead>Tipo</TableHead>
            {full && <TableHead>Recorrência</TableHead>}
            <TableHead>Status</TableHead>
            {full && <TableHead>Criado em</TableHead>}
            {full && <TableHead>Alertas</TableHead>}
            <TableHead className="text-right">
              {full ? "Último evento" : "Atualizado em"}
            </TableHead>
            {full && (
              <TableHead className="w-10">
                <span className="sr-only">Ações</span>
              </TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {trackings.map((tracking) => {
            const company = getParty(tracking.partyId);
            const href = identifierHref(tracking);
            const identifier = formatSearchKey(
              tracking.searchType,
              tracking.searchKey,
            );
            const lastEvent = tracking.juditTrackingId
              ? lastEvents.get(tracking.juditTrackingId)
              : undefined;
            const state = getTrackingDisplayState(tracking);

            return (
              <TableRow key={tracking.id}>
                <TableCell className="max-w-72">
                  {/* Nome da parte em cima, identificador embaixo; sem nome
                      (ou num processo), só o identificador. */}
                  {(() => {
                    const name =
                      tracking.searchType === "cnj" ? null : company?.name;
                    const main = name ?? identifier;
                    return (
                      <>
                        {href ? (
                          <Link
                            href={href}
                            title={main}
                            className={`block truncate rounded-sm text-foreground underline-offset-4 outline-none hover:text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 ${name ? "font-medium" : "font-mono text-xs"}`}
                          >
                            {main}
                          </Link>
                        ) : (
                          <span
                            title={main}
                            className={`block truncate ${name ? "font-medium" : "font-mono text-xs"}`}
                          >
                            {main}
                          </span>
                        )}
                        {name && (
                          <span className="block font-mono text-[11px] text-muted-foreground">
                            {identifier}
                          </span>
                        )}
                      </>
                    );
                  })()}
                  {full && (
                    <TrackingNote tracking={tracking} dataSource={dataSource} />
                  )}
                </TableCell>
                <TableCell>
                  <span title={searchTypeDescriptions[tracking.searchType]}>
                    <SearchTypeBadge type={tracking.searchType} />
                  </span>
                </TableCell>
                {full && (
                  <TableCell className="text-muted-foreground">
                    {formatRecurrence(tracking.recurrenceDays)}
                  </TableCell>
                )}
                <TableCell>
                  <TrackingStatusBadge tracking={tracking} />
                </TableCell>
                {full && (
                  <TableCell className="text-muted-foreground tabular-nums">
                    {formatDate(tracking.createdAt)}
                  </TableCell>
                )}
                {full && (
                  <TableCell>
                    <TrackingAlertsLink
                      trackingId={tracking.id}
                      counts={alertCounts.get(tracking.id)}
                    />
                  </TableCell>
                )}
                <TableCell className="text-right text-muted-foreground tabular-nums">
                  {full
                    ? lastEvent
                      ? formatDateTime(lastEvent)
                      : "Nenhum evento"
                    : formatDateTime(tracking.updatedAt)}
                </TableCell>
                {full && (
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Ações para ${identifier}`}
                          />
                        }
                      >
                        <EllipsisIcon />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52">
                        {company && (
                          <DropdownMenuItem
                            render={
                              <Link
                                href={partyHref(
                                  company.documentType,
                                  company.document,
                                )}
                              />
                            }
                          >
                            <Building2Icon />
                            Ver empresa
                          </DropdownMenuItem>
                        )}
                        {tracking.searchType === "cnj" && href && (
                          <DropdownMenuItem render={<Link href={href} />}>
                            <ScaleIcon />
                            Ver processo
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          render={
                            <Link
                              href={`/monitoramentos/alertas?monitoramento=${tracking.id}`}
                            />
                          }
                        >
                          <BellIcon />
                          Ver alertas
                        </DropdownMenuItem>
                        {supportView &&
                          (tracking.juditTrackingId ? (
                            <DropdownMenuItem
                              render={
                                <Link
                                  href={`/webhooks?referencia=${tracking.juditTrackingId}`}
                                />
                              }
                            >
                              <WebhookIcon />
                              Ver eventos recebidos
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem disabled>
                              <WebhookIcon />
                              Sem eventos (item local)
                            </DropdownMenuItem>
                          ))}
                        {dataSource === "db" && (
                          <JuditTrackingMenuItems
                            tracking={tracking}
                            onRequestDelete={setDeleting}
                            onRequestResults={trackingResults.open}
                          />
                        )}
                        {dataSource === "demo" &&
                          (state === "active" || state === "paused") && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() =>
                                  togglePause(tracking, state === "active")
                                }
                              >
                                {state === "active" ? (
                                  <PauseIcon />
                                ) : (
                                  <PlayIcon />
                                )}
                                {state === "active"
                                  ? "Pausar (demonstração)"
                                  : "Retomar (demonstração)"}
                              </DropdownMenuItem>
                            </>
                          )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <DeleteTrackingDialog
        tracking={deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
      />
      <TrackingResultsSheet
        view={trackingResults.view}
        onOpenChange={(open) => !open && trackingResults.close()}
      />
    </>
  );
}

type AlertCounts = { total: number; unread: number };

// Alertas por monitoramento (o `trackingId` local do alerta).
function countAlertsByTracking(
  alerts: { trackingId: string | null; readAt: Date | null }[],
): Map<string, AlertCounts> {
  const counts = new Map<string, AlertCounts>();
  for (const alert of alerts) {
    if (!alert.trackingId) continue;
    const entry = counts.get(alert.trackingId) ?? { total: 0, unread: 0 };
    entry.total += 1;
    if (!alert.readAt) entry.unread += 1;
    counts.set(alert.trackingId, entry);
  }
  return counts;
}

function TrackingAlertsLink({
  trackingId,
  counts,
}: {
  trackingId: string;
  counts: AlertCounts | undefined;
}) {
  if (!counts) return <span className="text-muted-foreground">Nenhum</span>;
  return (
    <Link
      href={`/monitoramentos/alertas?monitoramento=${trackingId}`}
      className="inline-flex items-center gap-1.5 rounded-sm text-sm underline-offset-4 outline-none hover:text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <span className="tabular-nums">{counts.total}</span>
      {counts.unread > 0 && (
        <span className="rounded-full bg-primary/10 px-1.5 text-xs text-primary tabular-nums">
          {counts.unread} não lidos
        </span>
      )}
    </Link>
  );
}

// Linha de apoio sob o identificador: o que aconteceu com a criação na
// JUDIT, ou quando será a primeira execução.
function TrackingNote({
  tracking,
  dataSource,
}: {
  tracking: Tracking;
  dataSource: "demo" | "db";
}) {
  let note: string | null = null;
  if (!tracking.juditTrackingId && dataSource === "demo") {
    note = "Criado localmente (sem ID da JUDIT)";
  } else if (tracking.creation === "pending") {
    note = tracking.creationError ?? "Reservado no banco, ainda não enviado";
  } else if (
    tracking.creation === "failed" ||
    tracking.creation === "uncertain" ||
    tracking.creation === "sending"
  ) {
    note = tracking.creationError ?? "Envio interrompido: conferir na JUDIT";
  } else if (tracking.status === "created" && tracking.hourRange !== null) {
    note = `Primeira execução prevista por volta das ${formatHourRange(tracking.hourRange)}`;
  }
  if (tracking.stepTerms?.length) {
    const terms = `Só movimentações com: ${tracking.stepTerms.join(", ")}`;
    note = note ? `${note}. ${terms}` : terms;
  }
  if (!note) return null;
  return (
    <span className="mt-0.5 block max-w-64 font-sans text-[11px] whitespace-normal text-muted-foreground">
      {note}
    </span>
  );
}
