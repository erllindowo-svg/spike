"use client";

import { ExternalLinkIcon, RefreshCwIcon, SendIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { CopyButton } from "@/components/shared/copy-button";
import { StatusBadge, type StatusTone } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import type { AsyncQueryMode, JuditRequest } from "@/db/models";
import type { Lawsuit } from "@/features/processes/types";
import { formatDateTime } from "@/lib/format";

import { checkAsyncQueryAction, startAsyncQueryAction } from "../actions";
import { ASYNC_QUERY_MODES, QUERY_MODES } from "../modes";
import type { ResponsesSummary } from "../responses";

import { ResponsesSummaryView } from "./responses-summary-view";

// Status documentados de uma request (OpenAPI). Um status desconhecido
// aparece como veio da JUDIT.
const statusLabels: Record<string, { label: string; tone: StatusTone }> = {
  pending: { label: "Na fila", tone: "pending" },
  started: { label: "Em andamento", tone: "info" },
  cancelling: { label: "Cancelando", tone: "warning" },
  cancelled: { label: "Cancelada", tone: "neutral" },
  completed: { label: "Concluída", tone: "success" },
};

export function AsyncQueriesCard({
  cnpj,
  queries,
  onSelectLawsuit,
}: {
  cnpj: string;
  queries: JuditRequest[];
  onSelectLawsuit: (lawsuit: Lawsuit) => void;
}) {
  const [starting, startTransition] = useTransition();
  const [startingMode, setStartingMode] = useState<AsyncQueryMode | null>(null);
  const [cacheTtl, setCacheTtl] = useState("");
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, ResponsesSummary>>({});

  const cacheTtlValue = cacheTtl.trim() === "" ? undefined : Number(cacheTtl);
  const cacheTtlInvalid =
    cacheTtlValue !== undefined &&
    (!Number.isInteger(cacheTtlValue) || cacheTtlValue <= 0);

  function start(mode: AsyncQueryMode) {
    setStartingMode(mode);
    startTransition(async () => {
      const result = await startAsyncQueryAction(
        mode === "historical_on_demand"
          ? { mode, cnpj, cacheTtlInDays: cacheTtlValue }
          : { mode, cnpj },
      );
      setStartingMode(null);
      if (!result.ok) {
        toast.error("Consulta não criada", { description: result.message });
        return;
      }
      toast.success(`${QUERY_MODES[mode].label} criada`, {
        description: `request_id ${result.request.requestId}`,
      });
    });
  }

  function check(requestId: string) {
    setCheckingId(requestId);
    startTransition(async () => {
      const result = await checkAsyncQueryAction(requestId);
      setCheckingId(null);
      if (!result.ok) {
        toast.error("Status não verificado", { description: result.message });
        return;
      }
      if (!result.results) {
        toast.info(`Status: ${statusLabel(result.request.status).label}`);
        return;
      }
      const loaded = result.results;
      setResults((current) => ({ ...current, [requestId]: loaded }));
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Consultas assíncronas</CardTitle>
        <CardDescription>
          Cada consulta é criada na JUDIT, que devolve um request_id. O
          resultado não vem na hora: verifique o status até a consulta ser
          concluída. Cada consulta é cobrada.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {ASYNC_QUERY_MODES.map((mode) => {
            const info = QUERY_MODES[mode];
            const onDemand = mode === "historical_on_demand";
            return (
              <div
                key={mode}
                className="flex flex-col gap-3 rounded-lg border p-4"
              >
                <div className="flex flex-col gap-1">
                  <span className="font-medium">{info.label}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {info.endpoint}
                  </span>
                </div>
                <dl className="flex flex-col gap-1.5 text-sm">
                  <div>
                    <dt className="inline text-muted-foreground">Fontes: </dt>
                    <dd className="inline">{info.sources}</dd>
                  </div>
                  <div>
                    <dt className="inline text-muted-foreground">Uso: </dt>
                    <dd className="inline">{info.purpose}</dd>
                  </div>
                  <div>
                    <dt className="inline text-muted-foreground">Custo: </dt>
                    <dd className="inline">{info.cost}</dd>
                  </div>
                </dl>
                {onDemand && (
                  <Field data-invalid={cacheTtlInvalid}>
                    <FieldLabel htmlFor="cache-ttl-in-days">
                      cache_ttl_in_days (opcional)
                    </FieldLabel>
                    <Input
                      id="cache-ttl-in-days"
                      inputMode="numeric"
                      placeholder="Ex.: 7"
                      value={cacheTtl}
                      onChange={(event) => setCacheTtl(event.target.value)}
                      aria-invalid={cacheTtlInvalid}
                      className="max-w-32"
                    />
                  </Field>
                )}
                <div className="mt-auto flex flex-wrap items-center gap-3">
                  <Button
                    size="sm"
                    onClick={() => start(mode)}
                    disabled={starting || (onDemand && cacheTtlInvalid)}
                  >
                    {startingMode === mode ? (
                      <Spinner data-icon="inline-start" />
                    ) : (
                      <SendIcon data-icon="inline-start" />
                    )}
                    Criar {info.label.toLowerCase()}
                  </Button>
                  <a
                    href={info.docsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:underline"
                  >
                    Documentação
                    <ExternalLinkIcon className="size-3" aria-hidden />
                  </a>
                </div>
              </div>
            );
          })}
        </div>

        {queries.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma consulta assíncrona criada para esta empresa.
          </p>
        ) : (
          <ul className="flex flex-col divide-y">
            {queries.map((query) => {
              const status = statusLabel(query.status);
              const loaded = results[query.requestId];
              return (
                <li
                  key={query.id}
                  className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex min-w-0 flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">
                          {QUERY_MODES[query.mode].label}
                        </span>
                        <StatusBadge tone={status.tone}>
                          {status.label}
                        </StatusBadge>
                        {query.cacheTtlInDays !== null && (
                          <span className="text-xs text-muted-foreground">
                            cache_ttl_in_days {query.cacheTtlInDays}
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-xs break-all text-muted-foreground">
                        request_id {query.requestId}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Criada em {formatDateTime(query.createdAt)}
                        {query.lastCheckedAt &&
                          ` · status verificado em ${formatDateTime(query.lastCheckedAt)}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CopyButton
                        value={query.requestId}
                        label="Copiar request_id"
                        successMessage="request_id copiado."
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => check(query.requestId)}
                        disabled={starting}
                      >
                        {checkingId === query.requestId ? (
                          <Spinner data-icon="inline-start" />
                        ) : (
                          <RefreshCwIcon data-icon="inline-start" />
                        )}
                        {query.status === "completed"
                          ? "Ver resultado"
                          : "Verificar status"}
                      </Button>
                    </div>
                  </div>
                  {loaded && (
                    <ResponsesSummaryView
                      results={loaded}
                      onSelectLawsuit={onSelectLawsuit}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function statusLabel(status: string): { label: string; tone: StatusTone } {
  return Object.hasOwn(statusLabels, status)
    ? statusLabels[status]
    : { label: status, tone: "warning" };
}
