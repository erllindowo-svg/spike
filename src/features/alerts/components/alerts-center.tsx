"use client";

import {
  BellOffIcon,
  CheckCheckIcon,
  CheckIcon,
  FilePlus2Icon,
  RadarIcon,
  ScrollTextIcon,
  WebhookIcon,
  XIcon,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/shared/empty-state";
import { PageIntro } from "@/components/shared/page-intro";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  alertTypeLabels,
  type AlertType,
  type AlertView,
} from "@/features/alerts/types";
import { partyHref } from "@/features/parties/documents";
import { formatCnj } from "@/features/processes/cnj";
import { SupportOnly } from "@/features/settings/support-view";
import { formatSearchKey } from "@/features/trackings/format";
import { useDemoStore } from "@/lib/demo-store";
import { formatDate, formatDateTime, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";

// Ícone e cor de cada tipo de alerta (também usados no Dashboard).
export const alertTypeStyles: Record<
  AlertType,
  { icon: LucideIcon; className: string }
> = {
  new_lawsuit: { icon: FilePlus2Icon, className: "bg-primary/10 text-primary" },
  lawsuit_movement: { icon: ScrollTextIcon, className: "bg-info/10 text-info" },
  tracking_notice: { icon: RadarIcon, className: "bg-warning/10 text-warning" },
};

type ReadFilter = "all" | "unread" | "read";

export function AlertsCenter() {
  const {
    alerts: allAlerts,
    trackings,
    dataSource,
    getParty,
    markAlertRead,
    markAllAlertsRead,
  } = useDemoStore();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [type, setType] = useState<AlertType | "all">("all");
  const [read, setRead] = useState<ReadFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // ?monitoramento=<id local> mostra só os alertas de um monitoramento (link
  // da coluna "Alertas" em Monitoramentos).
  const trackingId = searchParams.get("monitoramento");
  const tracking = trackingId
    ? (trackings.find((t) => t.id === trackingId) ?? null)
    : null;
  const alerts = trackingId
    ? allAlerts.filter((a) => a.trackingId === trackingId)
    : allAlerts;

  const unread = alerts.filter((a) => !a.readAt).length;
  const filtered = alerts.filter(
    (a) =>
      (type === "all" || a.type === type) &&
      (read === "all" || (read === "unread" ? !a.readAt : !!a.readAt)),
  );
  const selected = allAlerts.find((a) => a.id === selectedId) ?? null;

  // Agrupa o feed por dia, preservando a ordem cronológica decrescente.
  const groups: { day: string; items: AlertView[] }[] = [];
  for (const alert of [...filtered].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  )) {
    const day = formatDate(alert.createdAt);
    const group = groups.at(-1);
    if (group?.day === day) group.items.push(alert);
    else groups.push({ day, items: [alert] });
  }

  function open(alert: AlertView) {
    setSelectedId(alert.id);
    markAlertRead(alert.id);
  }

  return (
    <>
      <PageIntro description="Alertas gerados a partir de eventos dos monitoramentos: novos processos, movimentações e avisos sobre os próprios monitoramentos.">
        <Button
          variant="outline"
          disabled={unread === 0}
          onClick={async () => {
            // Com o filtro de monitoramento, só os alertas dele.
            const error = await markAllAlertsRead(trackingId ?? undefined);
            if (error) toast.error(error);
            else
              toast.success(
                trackingId
                  ? "Alertas deste monitoramento marcados como lidos."
                  : "Todos os alertas foram marcados como lidos.",
              );
          }}
        >
          <CheckCheckIcon data-icon="inline-start" />
          {trackingId ? "Marcar estes como lidos" : "Marcar todos como lidos"}
        </Button>
      </PageIntro>

      {trackingId && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Monitoramento:</span>
          <span className="inline-flex items-center gap-1 rounded-full border bg-muted/40 py-0.5 pr-1 pl-2.5">
            <span className="font-mono text-xs">
              {tracking
                ? formatSearchKey(tracking.searchType, tracking.searchKey)
                : "não encontrado"}
            </span>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Mostrar alertas de todos os monitoramentos"
              onClick={() => router.replace(pathname, { scroll: false })}
            >
              <XIcon />
            </Button>
          </span>
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <ToggleGroup
          variant="outline"
          spacing={0}
          size="sm"
          value={[type]}
          onValueChange={(v) => v[0] && setType(v[0] as AlertType | "all")}
          aria-label="Filtrar por tipo"
          className="flex-wrap"
        >
          <ToggleGroupItem value="all">Todos os tipos</ToggleGroupItem>
          {(Object.keys(alertTypeLabels) as AlertType[]).map((t) => (
            <ToggleGroupItem key={t} value={t}>
              {alertTypeLabels[t]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <ToggleGroup
          variant="outline"
          spacing={0}
          size="sm"
          value={[read]}
          onValueChange={(v) => v[0] && setRead(v[0] as ReadFilter)}
          aria-label="Filtrar por estado de leitura"
        >
          <ToggleGroupItem value="all">Todos</ToggleGroupItem>
          <ToggleGroupItem value="unread">
            Não lidos{unread > 0 && ` (${unread})`}
          </ToggleGroupItem>
          <ToggleGroupItem value="read">Lidos</ToggleGroupItem>
        </ToggleGroup>
      </div>

      <Card className="gap-0 py-0">
        {groups.length === 0 ? (
          <EmptyState
            icon={BellOffIcon}
            title={
              alerts.length === 0
                ? "Nenhum alerta ainda"
                : read === "unread"
                  ? "Tudo em dia"
                  : "Nenhum alerta corresponde aos filtros"
            }
            description={
              alerts.length === 0 || read === "unread"
                ? dataSource === "db"
                  ? "Novos alertas aparecem quando a JUDIT entrega eventos dos monitoramentos. O diagnóstico de webhooks mostra cada entrega e o que foi feito com ela."
                  : "Novos alertas aparecem quando os monitoramentos recebem eventos. Você pode simular um evento no diagnóstico de webhooks."
                : "Ajuste os filtros de tipo ou de leitura."
            }
            action={
              <SupportOnly>
                <Button
                  variant="outline"
                  nativeButton={false}
                  render={<Link href="/webhooks" />}
                >
                  <WebhookIcon data-icon="inline-start" />
                  Ir para o diagnóstico
                </Button>
              </SupportOnly>
            }
          />
        ) : (
          groups.map((group) => (
            <section key={group.day} aria-label={group.day}>
              <h2 className="border-b bg-muted/40 px-4 py-1.5 text-xs font-medium text-muted-foreground">
                {group.day}
              </h2>
              <ul className="divide-y">
                {group.items.map((alert) => {
                  const { icon: Icon, className } = alertTypeStyles[alert.type];
                  const company = getParty(alert.partyId);
                  return (
                    <li
                      key={alert.id}
                      className={cn(
                        "group relative flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/40",
                        !alert.readAt && "bg-primary/[0.03]",
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full",
                          className,
                        )}
                      >
                        <Icon className="size-4" aria-hidden />
                      </span>
                      <button
                        type="button"
                        onClick={() => open(alert)}
                        className="flex min-w-0 flex-1 flex-col gap-0.5 rounded-sm text-left outline-none after:absolute after:inset-0 focus-visible:ring-2 focus-visible:ring-ring/50"
                      >
                        <span className="flex flex-wrap items-center gap-2">
                          {!alert.readAt && (
                            <span
                              className="size-2 rounded-full bg-primary"
                              aria-label="Não lido"
                            />
                          )}
                          <span
                            className={cn(
                              "text-sm",
                              alert.readAt
                                ? "text-foreground"
                                : "font-semibold",
                            )}
                          >
                            {alert.title}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {alertTypeLabels[alert.type]}
                          </span>
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {alert.description}
                        </span>
                        <span className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                          {company && (
                            <span>{company.name ?? "Nome não consultado"}</span>
                          )}
                          {alert.lawsuitCnj && (
                            <span className="font-mono">
                              {formatCnj(alert.lawsuitCnj)}
                            </span>
                          )}
                        </span>
                      </button>
                      <div className="relative z-10 flex shrink-0 flex-col items-end gap-1.5">
                        <time
                          dateTime={alert.createdAt.toISOString()}
                          className="text-xs text-muted-foreground tabular-nums"
                        >
                          {formatTime(alert.createdAt)}
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
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
      </Card>

      <AlertSheet alert={selected} onClose={() => setSelectedId(null)} />
    </>
  );
}

function AlertSheet({
  alert,
  onClose,
}: {
  alert: AlertView | null;
  onClose: () => void;
}) {
  const { getParty, webhookEvents } = useDemoStore();
  const company = alert ? getParty(alert.partyId) : null;
  const event = alert?.webhookEventId
    ? webhookEvents.find((e) => e.id === alert.webhookEventId)
    : undefined;

  return (
    <Sheet open={!!alert} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full gap-0 data-[side=right]:sm:max-w-md">
        {alert && (
          <>
            <SheetHeader className="border-b">
              <SheetDescription>{alertTypeLabels[alert.type]}</SheetDescription>
              <SheetTitle>{alert.title}</SheetTitle>
            </SheetHeader>
            <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
              <p className="text-sm">{alert.description}</p>
              <Separator />
              <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-3 text-sm">
                <dt className="text-muted-foreground">Gerado em</dt>
                <dd className="tabular-nums">
                  {formatDateTime(alert.createdAt)}
                </dd>
                <dt className="text-muted-foreground">Leitura</dt>
                <dd>
                  {alert.readAt ? (
                    <StatusBadge tone="neutral">
                      Lido em {formatDateTime(alert.readAt)}
                    </StatusBadge>
                  ) : (
                    <StatusBadge tone="info">Não lido</StatusBadge>
                  )}
                </dd>
                <dt className="text-muted-foreground">
                  {company?.documentType === "cpf" ? "Pessoa" : "Empresa"}
                </dt>
                <dd>
                  {company ? (
                    <Link
                      href={partyHref(company.documentType, company.document)}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      {company.name ?? "Nome não consultado"}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">Não associada</span>
                  )}
                </dd>
                <dt className="text-muted-foreground">Processo</dt>
                <dd>
                  {alert.lawsuitCnj ? (
                    <Link
                      href={`/processos/${alert.lawsuitCnj}`}
                      className="font-mono text-xs text-primary underline-offset-4 hover:underline"
                    >
                      {formatCnj(alert.lawsuitCnj)}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">Não informado</span>
                  )}
                </dd>
                <SupportOnly>
                  <dt className="text-muted-foreground">Evento de origem</dt>
                  <dd className="min-w-0">
                    {event ? (
                      <Link
                        href={`/webhooks?evento=${event.id}`}
                        className="block truncate font-mono text-xs text-primary underline-offset-4 hover:underline"
                      >
                        {event.callbackId ?? event.id}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">
                        Sem evento associado
                      </span>
                    )}
                  </dd>
                </SupportOnly>
              </dl>
            </div>
            <SheetFooter className="border-t">
              <Button variant="outline" onClick={onClose}>
                Fechar
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
