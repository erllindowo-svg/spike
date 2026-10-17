"use client";

import { EyeIcon, RefreshCwIcon, WebhookIcon } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { CopyButton } from "@/components/shared/copy-button";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { LawsuitSheet } from "@/features/processes/components/lawsuit-sheet";
import type { Lawsuit } from "@/features/processes/types";
import { formatSearchKey } from "@/features/trackings/format";
import { SERVER_UNREACHABLE } from "@/lib/demo-store";
import { formatNumber } from "@/lib/format";

import { checkAsyncQueryAction } from "../actions";
import type { DeliveryCheck } from "../deliveries";
import { QUERY_MODES } from "../modes";
import type { ResponsesSummary } from "../responses";
import { asyncStatusLabel } from "../status";
import { isQueryOpen, type QueryView } from "../types";
import { ResponsesSummaryView } from "./responses-summary-view";

// Células de uma consulta do histórico, usadas na ficha do assunto
// (src/features/subjects): o resultado em palavras e, nas assíncronas,
// "Verificar status" e "Ver resultado"; o request_id na vista de suporte.

// O que a consulta trouxe, em palavras. Usado também na ficha do assunto
// (src/features/subjects). Os dados ficam na base própria (círculo 3).
export function QueryResult({ query }: { query: QueryView }) {
  if (query.flow === "async") {
    if (query.asyncStatus === "completed" && query.requestId) {
      return <ViewResultButton query={query} requestId={query.requestId} />;
    }
    return isQueryOpen(query) && query.requestId ? (
      <CheckStatusButton requestId={query.requestId} />
    ) : (
      "—"
    );
  }
  if (query.syncOutcome !== "ok" || query.resultCount === null) return "—";
  if (
    query.mode === "registration_data" ||
    query.mode === "registration_on_demand"
  ) {
    return query.resultCount > 0 ? "Cadastro encontrado" : "Sem cadastro";
  }
  if (query.mode === "lawsuit_datalake" || query.mode === "lawsuit_on_demand") {
    return query.resultCount > 0 ? "Processo encontrado" : "Não encontrado";
  }
  if (query.mode === "datalake_synthetic") {
    return `Resumo de ${formatNumber(query.resultCount)} processos`;
  }
  return query.resultCount === 1
    ? "1 processo"
    : `${formatNumber(query.resultCount)} processos`;
}

export function RequestIdCell({ query }: { query: QueryView }) {
  if (!query.requestId) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  return (
    <span className="flex items-center gap-1">
      <span className="font-mono text-xs" title={query.requestId}>
        {query.requestId.slice(0, 8)}…
      </span>
      <CopyButton
        value={query.requestId}
        label="Copiar request_id"
        successMessage="request_id copiado."
      />
      {query.flow === "async" && (
        <Link
          href={`/webhooks?referencia=${query.requestId}`}
          className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Ver entregas de webhook desta consulta"
          title="Ver entregas de webhook desta consulta"
        >
          <WebhookIcon className="size-3.5" aria-hidden />
        </Link>
      )}
    </span>
  );
}

// Pergunta o status à JUDIT (GET /requests/{id}) daqui mesmo. A action grava
// o status e chama refresh(): a linha se atualiza com a resposta.
function CheckStatusButton({ requestId }: { requestId: string }) {
  const [checking, startCheck] = useTransition();

  return (
    <Button
      variant="outline"
      size="xs"
      disabled={checking}
      onClick={() =>
        startCheck(async () => {
          try {
            const result = await checkAsyncQueryAction(requestId);
            if (!result.ok) {
              toast.error("Status não verificado", {
                description: result.message,
              });
            } else if (result.request.status === "completed") {
              toast.success("Consulta concluída", {
                description: "Use “Ver resultado” para abrir.",
              });
            } else {
              toast.info(
                `Status: ${asyncStatusLabel(result.request.status).label}`,
              );
            }
          } catch {
            toast.error(SERVER_UNREACHABLE);
          }
        })
      }
    >
      {checking ? (
        <Spinner data-icon="inline-start" />
      ) : (
        <RefreshCwIcon data-icon="inline-start" />
      )}
      Verificar status
    </Button>
  );
}

// Lê o resultado de uma consulta assíncrona concluída (GET /responses) e
// mostra num painel lateral. Serve a todos os tipos, inclusive os por CNJ,
// que não têm página de parte. O resultado não fica salvo.
function ViewResultButton({
  query,
  requestId,
}: {
  query: QueryView;
  requestId: string;
}) {
  const [loading, startLoading] = useTransition();
  const [results, setResults] = useState<{
    summary: ResponsesSummary;
    deliveryCheck: DeliveryCheck | null;
  } | null>(null);
  const [selected, setSelected] = useState<Lawsuit | null>(null);

  return (
    <>
      <Button
        variant="outline"
        size="xs"
        disabled={loading}
        onClick={() =>
          startLoading(async () => {
            try {
              const result = await checkAsyncQueryAction(requestId);
              if (!result.ok) {
                toast.error("Resultado não lido", {
                  description: result.message,
                });
              } else if (result.results) {
                setResults({
                  summary: result.results,
                  deliveryCheck: result.deliveryCheck,
                });
              }
            } catch {
              toast.error(SERVER_UNREACHABLE);
            }
          })
        }
      >
        {loading ? (
          <Spinner data-icon="inline-start" />
        ) : (
          <EyeIcon data-icon="inline-start" />
        )}
        Ver resultado
      </Button>
      <Sheet
        open={!!results}
        onOpenChange={(open) => !open && setResults(null)}
      >
        <SheetContent className="w-full gap-0 data-[side=right]:sm:max-w-2xl">
          <SheetHeader className="border-b">
            <SheetDescription>
              {formatSearchKey(query.searchType, query.searchKey)}
            </SheetDescription>
            <SheetTitle>{QUERY_MODES[query.mode].label}</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-4">
            {results && (
              <ResponsesSummaryView
                results={results.summary}
                deliveryCheck={results.deliveryCheck}
                onSelectLawsuit={setSelected}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
      <LawsuitSheet
        lawsuit={selected}
        onOpenChange={(open) => !open && setSelected(null)}
      />
    </>
  );
}
