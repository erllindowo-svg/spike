"use client";

import { WebhookIcon } from "lucide-react";
import Link from "next/link";

import { CopyButton } from "@/components/shared/copy-button";
import { formatNumber } from "@/lib/format";

import { asyncStatusLabel } from "../status";
import type { QueryView } from "../types";

// Células de uma consulta do histórico, usadas na ficha do assunto
// (src/features/subjects): o resultado em palavras e o request_id na vista
// de suporte.

// O que a consulta trouxe, em palavras. Usado também na ficha do assunto
// (src/features/subjects). Os dados ficam na base própria (círculo 3).
export function QueryResult({ query }: { query: QueryView }) {
  // No app real, as assíncronas têm "Verificar status" e "Ver resultado",
  // que consultam a JUDIT. No protótipo, só a situação fictícia.
  if (query.flow === "async") {
    return query.asyncStatus ? asyncStatusLabel(query.asyncStatus).label : "—";
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
