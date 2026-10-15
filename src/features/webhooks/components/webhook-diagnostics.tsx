"use client";

import {
  ChevronDownIcon,
  CopyXIcon,
  FilePlus2Icon,
  InfoIcon,
  ScrollTextIcon,
  SearchIcon,
  TriangleAlertIcon,
  WebhookIcon,
  XIcon,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/shared/empty-state";
import { PageIntro } from "@/components/shared/page-intro";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { countByStatus } from "@/features/webhooks/stats";
import {
  getProcessingDurationMs,
  processingStatusLabels,
  type WebhookEventView,
  type WebhookProcessingStatus,
} from "@/features/webhooks/types";
import { useDemoStore, type SimulationScenario } from "@/lib/demo-store";
import {
  formatDuration,
  formatNumber,
  formatPreciseDateTime,
} from "@/lib/format";
import { cn } from "@/lib/utils";

import { ProcessingStatusBadge } from "./processing-status-badge";
import { WebhookEventSheet } from "./webhook-event-sheet";

const NO_EVENT_TYPE = "__none__";

const scenarios: {
  value: SimulationScenario;
  label: string;
  description: string;
  icon: typeof WebhookIcon;
}[] = [
  {
    value: "lawsuit_movement",
    label: "Movimentação em processo monitorado",
    description: "Processado com sucesso e gera um alerta",
    icon: ScrollTextIcon,
  },
  {
    value: "new_lawsuit",
    label: "Novo processo para CNPJ monitorado",
    description: "Processado com sucesso e gera um alerta",
    icon: FilePlus2Icon,
  },
  {
    value: "unknown_reference",
    label: "Referência desconhecida",
    description: "Recebido, mas falha no processamento",
    icon: TriangleAlertIcon,
  },
  {
    value: "duplicate_delivery",
    label: "Reentrega duplicada",
    description: "Mesmo callback_id; descartado sem reprocessar",
    icon: CopyXIcon,
  },
];

function shortId(id: string | null): string {
  if (!id) return "—";
  return id.length > 13 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id;
}

export function WebhookDiagnostics() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { webhookEvents, simulateWebhookEvent, dataSource } = useDemoStore();

  const reference = searchParams.get("referencia");
  const selectedId = searchParams.get("evento");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<WebhookProcessingStatus | "all">("all");
  const [eventType, setEventType] = useState("all");

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const counts = countByStatus(webhookEvents);
  const duplicates = webhookEvents.reduce(
    (sum, e) => sum + e.duplicateDeliveries,
    0,
  );
  const eventTypes = [
    ...new Set(webhookEvents.map((e) => e.eventType ?? NO_EVENT_TYPE)),
  ];
  const statusItems = [
    { value: "all", label: "Todos os status" },
    ...(Object.keys(processingStatusLabels) as WebhookProcessingStatus[]).map(
      (s) => ({ value: s, label: processingStatusLabels[s] }),
    ),
  ];
  const typeItems = [
    { value: "all", label: "Todos os event_type" },
    ...eventTypes.map((t) => ({
      value: t,
      label: t === NO_EVENT_TYPE ? "(sem event_type)" : t,
    })),
  ];

  const term = query.trim().toLowerCase();
  const filtered = webhookEvents.filter((e) => {
    if (reference && e.referenceId !== reference) return false;
    if (status !== "all" && e.processingStatus !== status) return false;
    if (eventType !== "all" && (e.eventType ?? NO_EVENT_TYPE) !== eventType) {
      return false;
    }
    if (!term) return true;
    return [e.callbackId, e.referenceId, e.eventType].some((v) =>
      v?.toLowerCase().includes(term),
    );
  });
  const selected = webhookEvents.find((e) => e.id === selectedId) ?? null;
  const hasFilters =
    !!term || status !== "all" || eventType !== "all" || !!reference;

  function simulate(scenario: SimulationScenario) {
    const result = simulateWebhookEvent(scenario);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(
      result.duplicate
        ? "Reentrega simulada: callback_id já conhecido"
        : "Evento simulado recebido",
      {
        description: result.duplicate
          ? "O evento original não foi reprocessado; apenas o contador de reentregas aumentou. Nada foi enviado à JUDIT."
          : "O evento foi inserido localmente e será processado em instantes. Nada foi enviado à JUDIT.",
        action: {
          label: "Abrir",
          onClick: () => setParam("evento", result.eventId),
        },
      },
    );
  }

  const tiles: {
    label: string;
    value: number;
    tone: string;
    filter?: WebhookProcessingStatus;
  }[] = [
    {
      label: "Recebidos",
      value: webhookEvents.length,
      tone: "text-foreground",
    },
    {
      label: "Processados",
      value: counts.processed,
      tone: "text-success",
      filter: "processed",
    },
    {
      label: "Não processados",
      value: counts.pending + counts.processing,
      tone: "text-warning",
      filter: "pending",
    },
    {
      label: "Com falha",
      value: counts.failed,
      tone: "text-destructive",
      filter: "failed",
    },
    {
      label: "Reentregas descartadas",
      value: duplicates,
      tone: "text-muted-foreground",
    },
  ];

  return (
    <>
      <PageIntro description="Inspecione os callbacks recebidos, o processamento de cada um e os alertas gerados. Útil para investigar duplicidades, falhas e eventos ainda não processados.">
        {/* A simulação só existe no modo de demonstração. */}
        {dataSource === "demo" && (
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button />}>
              <WebhookIcon data-icon="inline-start" />
              Simular evento
              <ChevronDownIcon data-icon="inline-end" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuGroup>
                <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                  Simulação local: nenhum dado é enviado ou recebido da JUDIT.
                </DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              {scenarios.map((s) => (
                <DropdownMenuItem
                  key={s.value}
                  onClick={() => simulate(s.value)}
                  className="items-start"
                >
                  <s.icon className="mt-0.5" />
                  <span className="flex flex-col">
                    <span>{s.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {s.description}
                    </span>
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </PageIntro>

      <Alert>
        <InfoIcon />
        {dataSource === "db" ? (
          <>
            <AlertTitle>Entregas reais da JUDIT</AlertTitle>
            <AlertDescription>
              Cada linha é uma entrega gravada pela rota do webhook. O
              processamento roda logo depois da resposta à JUDIT; um evento com
              falha ou ignorado pode ser reprocessado no detalhe. Mostra as 200
              entregas mais recentes.
            </AlertDescription>
          </>
        ) : (
          <>
            <AlertTitle>Modo demonstração</AlertTitle>
            <AlertDescription>
              Os eventos abaixo são fictícios e o processamento é simulado no
              navegador. No modo banco de dados, esta tela mostra as entregas
              reais gravadas pela rota do webhook.
            </AlertDescription>
          </>
        )}
      </Alert>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map((tile) => {
          const active = !!tile.filter && status === tile.filter;
          const content = (
            <>
              <span className="text-xs text-muted-foreground">
                {tile.label}
              </span>
              <span
                className={cn("text-xl font-semibold tabular-nums", tile.tone)}
              >
                {formatNumber(tile.value)}
              </span>
            </>
          );
          const base =
            "flex flex-col items-start gap-1 rounded-xl bg-card p-3 text-left ring-1 ring-foreground/10";
          return tile.filter ? (
            <button
              key={tile.label}
              type="button"
              aria-pressed={active}
              onClick={() => setStatus(active ? "all" : tile.filter!)}
              className={cn(
                base,
                "transition outline-none hover:ring-primary/40 focus-visible:ring-2 focus-visible:ring-ring",
                active && "ring-2 ring-primary/60",
              )}
            >
              {content}
            </button>
          ) : (
            <div key={tile.label} className={base}>
              {content}
            </div>
          );
        })}
      </div>

      <Card className="gap-0 py-0">
        <div className="flex flex-col gap-2 border-b p-4 lg:flex-row lg:items-center">
          <div className="relative w-full lg:max-w-sm">
            <SearchIcon
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar callback_id, reference_id ou event_type"
              aria-label="Buscar eventos"
              className="pl-8 font-mono text-xs placeholder:font-sans placeholder:text-sm"
            />
          </div>
          {reference && (
            <span className="inline-flex h-7 max-w-full items-center gap-1 rounded-full border bg-muted/50 pr-1 pl-2.5 text-xs">
              <span className="text-muted-foreground">reference_id:</span>
              <span className="truncate font-mono">{shortId(reference)}</span>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Remover filtro de referência"
                onClick={() => setParam("referencia", null)}
              >
                <XIcon />
              </Button>
            </span>
          )}
          <div className="flex flex-wrap gap-2 lg:ml-auto">
            <Select
              items={typeItems}
              value={eventType}
              onValueChange={(v) => v && setEventType(v)}
            >
              <SelectTrigger size="sm" className="w-52" aria-label="event_type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {typeItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              items={statusItems}
              value={status}
              onValueChange={(v) =>
                v && setStatus(v as WebhookProcessingStatus | "all")
              }
            >
              <SelectTrigger
                size="sm"
                className="w-56"
                aria-label="Status de processamento"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <CardContent className="px-2">
          {filtered.length === 0 ? (
            <EmptyState
              icon={WebhookIcon}
              title={
                hasFilters
                  ? "Nenhum evento corresponde aos filtros"
                  : "Nenhum evento recebido"
              }
              description={
                hasFilters
                  ? "Ajuste a busca ou os filtros."
                  : dataSource === "db"
                    ? "As entregas aparecem aqui quando a JUDIT chama a rota do webhook (src/features/webhooks/README.md)."
                    : "Use “Simular evento” para inserir um callback fictício."
              }
              action={
                hasFilters ? (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setQuery("");
                      setStatus("all");
                      setEventType("all");
                      setParam("referencia", null);
                    }}
                  >
                    Limpar filtros
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Recebido em</TableHead>
                  <TableHead>callback_id</TableHead>
                  <TableHead>event_type</TableHead>
                  <TableHead>reference_id</TableHead>
                  <TableHead>Processamento</TableHead>
                  <TableHead className="text-right">Duração</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((event) => (
                  <EventRow
                    key={event.id}
                    event={event}
                    onOpen={() => setParam("evento", event.id)}
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <WebhookEventSheet
        event={selected}
        onClose={() => setParam("evento", null)}
      />
    </>
  );
}

function EventRow({
  event,
  onOpen,
}: {
  event: WebhookEventView;
  onOpen: () => void;
}) {
  const inFlight = event.processingStatus === "processing";

  return (
    <TableRow className="cursor-pointer" onClick={onOpen}>
      <TableCell className="text-muted-foreground tabular-nums">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
          className="rounded-sm text-left text-foreground outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          {formatPreciseDateTime(event.receivedAt)}
        </button>
      </TableCell>
      <TableCell
        className="font-mono text-xs"
        title={event.callbackId ?? undefined}
      >
        <span className="flex items-center gap-1.5">
          {event.callbackId ? (
            shortId(event.callbackId)
          ) : (
            <span className="font-sans text-muted-foreground">ausente</span>
          )}
          {event.duplicateDeliveries > 0 && (
            <span
              className="rounded-full border border-warning/30 bg-warning/10 px-1.5 font-sans text-[11px] text-warning"
              title="Reentregas descartadas"
            >
              +{event.duplicateDeliveries}
            </span>
          )}
        </span>
      </TableCell>
      <TableCell className="font-mono text-xs">
        {event.eventType ?? (
          <span className="font-sans text-muted-foreground">ausente</span>
        )}
      </TableCell>
      <TableCell
        className="font-mono text-xs"
        title={event.referenceId ?? undefined}
      >
        {event.referenceId ? (
          shortId(event.referenceId)
        ) : (
          <span className="font-sans text-muted-foreground">ausente</span>
        )}
      </TableCell>
      <TableCell>
        <span className="flex items-center gap-2">
          <ProcessingStatusBadge status={event.processingStatus} />
          {inFlight && <Spinner className="size-3.5 text-muted-foreground" />}
        </span>
      </TableCell>
      <TableCell className="text-right text-muted-foreground tabular-nums">
        {formatDuration(getProcessingDurationMs(event))}
      </TableCell>
    </TableRow>
  );
}
