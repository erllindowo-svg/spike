"use client";

import { BellIcon, CircleAlertIcon, RotateCwIcon } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";

import { CopyButton } from "@/components/shared/copy-button";
import { JsonViewer } from "@/components/shared/json-viewer";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatSearchKey } from "@/features/trackings/format";
import { reprocessWebhookEventAction } from "@/features/webhooks/actions";
import {
  getProcessingDurationMs,
  type WebhookEventView,
} from "@/features/webhooks/types";
import { SERVER_UNREACHABLE, useAppStore } from "@/lib/app-store";
import { formatDuration, formatPreciseDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

import { ProcessingStatusBadge } from "./processing-status-badge";

type StepState = "done" | "current" | "failed" | "skipped";

function Step({
  title,
  state,
  children,
  last,
}: {
  title: string;
  state: StepState;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <li className="relative flex gap-3 pb-4 last:pb-0">
      {!last && (
        <span
          aria-hidden
          className="absolute top-5 bottom-0 left-[9px] w-px bg-border"
        />
      )}
      <span
        aria-hidden
        className={cn(
          "relative mt-0.5 size-[19px] shrink-0 rounded-full border-2",
          state === "done" && "border-success bg-success/15",
          state === "current" && "animate-pulse border-warning bg-warning/15",
          state === "failed" && "border-destructive bg-destructive/15",
          state === "skipped" && "border-border bg-muted",
        )}
      />
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm font-medium">{title}</span>
        <div className="text-xs text-muted-foreground">{children}</div>
      </div>
    </li>
  );
}

function MetaRow({
  label,
  value,
  mono = true,
  children,
}: {
  label: string;
  value: string | null;
  mono?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <>
      <dt className="font-mono text-xs text-muted-foreground">{label}</dt>
      <dd
        className={cn("min-w-0 text-sm break-all", mono && "font-mono text-xs")}
      >
        {value ?? (
          <span className="font-sans text-muted-foreground">ausente</span>
        )}
        {children}
      </dd>
    </>
  );
}

export function WebhookEventSheet({
  event,
  onClose,
}: {
  event: WebhookEventView | null;
  onClose: () => void;
}) {
  const { trackings, alerts } = useAppStore();
  const tracking = event?.referenceId
    ? trackings.find((t) => t.juditTrackingId === event.referenceId)
    : undefined;
  const generatedAlerts = event
    ? alerts.filter((a) => event.alertIds.includes(a.id))
    : [];
  const status = event?.processingStatus;
  const json = event ? JSON.stringify(event.payload, null, 2) : "";

  return (
    <Sheet open={!!event} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full gap-0 data-[side=right]:sm:max-w-2xl">
        {event && (
          <>
            <SheetHeader className="border-b">
              <SheetDescription>Evento de webhook</SheetDescription>
              <SheetTitle className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-base">
                  {event.eventType ?? "event_type ausente"}
                </span>
                <ProcessingStatusBadge status={event.processingStatus} />
              </SheetTitle>
            </SheetHeader>

            <Tabs defaultValue="summary" className="min-h-0 flex-1 gap-0">
              <div className="border-b px-4 py-2">
                <TabsList>
                  <TabsTrigger value="summary">Resumo</TabsTrigger>
                  <TabsTrigger value="payload">Payload JSON</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="summary" className="overflow-y-auto p-4">
                <div className="flex flex-col gap-5">
                  {event.processingStatus !== "processed" && (
                    <ReprocessButton eventId={event.id} />
                  )}
                  {event.processingError && (
                    <Alert variant="destructive">
                      <CircleAlertIcon />
                      <AlertTitle>Erro de processamento</AlertTitle>
                      <AlertDescription>
                        {event.processingError}
                      </AlertDescription>
                    </Alert>
                  )}

                  <section className="flex flex-col gap-3">
                    <h3 className="text-sm font-semibold">Ciclo do evento</h3>
                    <ol>
                      <Step title="Recebimento" state="done">
                        {formatPreciseDateTime(event.receivedAt)} · payload
                        armazenado
                        {event.duplicateDeliveries > 0 &&
                          ` · ${event.duplicateDeliveries} reentrega(s) com o mesmo callback_id descartada(s)`}
                      </Step>
                      <Step
                        title="Processamento"
                        state={
                          status === "processed"
                            ? "done"
                            : status === "failed"
                              ? "failed"
                              : status === "ignored"
                                ? "skipped"
                                : "current"
                        }
                      >
                        {event.processedAt
                          ? `${formatPreciseDateTime(event.processedAt)} · duração ${formatDuration(getProcessingDurationMs(event))}`
                          : status === "processing"
                            ? "Em andamento"
                            : "Aguardando processamento"}
                        {event.processingNote && (
                          <span className="mt-1 block text-foreground">
                            {event.processingNote}
                          </span>
                        )}
                      </Step>
                      <Step
                        title="Geração de alertas"
                        state={generatedAlerts.length > 0 ? "done" : "skipped"}
                        last
                      >
                        {generatedAlerts.length > 0 ? (
                          <ul className="mt-1 flex flex-col gap-1">
                            {generatedAlerts.map((a) => (
                              <li key={a.id}>
                                <Link
                                  href="/acervo"
                                  className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
                                >
                                  <BellIcon className="size-3" aria-hidden />
                                  {a.title}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          "Nenhum alerta gerado"
                        )}
                      </Step>
                    </ol>
                  </section>

                  <section className="flex flex-col gap-3">
                    <h3 className="text-sm font-semibold">Envelope</h3>
                    <dl className="grid grid-cols-[8.5rem_1fr] gap-x-3 gap-y-2.5">
                      <MetaRow label="callback_id" value={event.callbackId} />
                      <MetaRow label="event_type" value={event.eventType} />
                      <MetaRow
                        label="reference_type"
                        value={event.referenceType}
                      />
                      <MetaRow label="reference_id" value={event.referenceId}>
                        <span className="mt-1 block font-sans text-xs text-muted-foreground">
                          {tracking ? (
                            <>
                              Monitoramento local:{" "}
                              <Link
                                href="/acervo?monitorado=1"
                                className="text-primary underline-offset-4 hover:underline"
                              >
                                {formatSearchKey(
                                  tracking.searchType,
                                  tracking.searchKey,
                                )}
                              </Link>
                            </>
                          ) : event.referenceType === "request" ? (
                            "Consulta assíncrona (request_id). O resultado do processamento diz se ela é desta aplicação."
                          ) : event.referenceId ? (
                            "Nenhum monitoramento local corresponde a esta referência."
                          ) : null}
                        </span>
                      </MetaRow>
                      <MetaRow
                        label="recebido em"
                        value={formatPreciseDateTime(event.receivedAt)}
                        mono={false}
                      />
                      <MetaRow
                        label="processado em"
                        value={
                          event.processedAt
                            ? formatPreciseDateTime(event.processedAt)
                            : null
                        }
                        mono={false}
                      />
                    </dl>
                  </section>
                </div>
              </TabsContent>

              <TabsContent
                value="payload"
                className="flex min-h-0 flex-col gap-3 overflow-y-auto p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">
                    Payload como armazenado: dados de processo resumidos (fora
                    do modo manutenção) e token mascarado.
                  </p>
                  <CopyButton
                    value={json}
                    label="Copiar JSON"
                    successMessage="Payload copiado."
                  />
                </div>
                <JsonViewer value={event.payload} className="max-h-none" />
              </TabsContent>
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

// Roda as regras de novo (src/features/webhooks/process.ts). Útil para um
// evento "failed", "ignored" (a referência pode ter sido gravada depois) ou
// preso em "processing". A tela é atualizada pelo refresh() da action.
function ReprocessButton({ eventId }: { eventId: string }) {
  const [pending, startTransition] = useTransition();

  function reprocess() {
    startTransition(async () => {
      try {
        const response = await reprocessWebhookEventAction(eventId);
        if (!response.ok) {
          toast.error(response.message);
          return;
        }
        const { result } = response;
        if (result.status === "skipped") {
          toast.info(
            "Nada a fazer: o evento já foi processado ou está em processamento.",
          );
        } else if (result.status === "failed") {
          toast.error("O processamento falhou de novo.", {
            description: result.error,
          });
        } else {
          toast.success(
            result.status === "processed"
              ? "Evento processado."
              : "Evento ignorado.",
            { description: result.note },
          );
        }
      } catch {
        toast.error(SERVER_UNREACHABLE);
      }
    });
  }

  return (
    <div className="flex justify-end">
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={reprocess}
      >
        <RotateCwIcon data-icon="inline-start" />
        {pending ? "Reprocessando…" : "Reprocessar"}
      </Button>
    </div>
  );
}
