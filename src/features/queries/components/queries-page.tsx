"use client";

import { FileSearchIcon, SearchIcon, WebhookIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { CopyButton } from "@/components/shared/copy-button";
import { EmptyState } from "@/components/shared/empty-state";
import { PageIntro } from "@/components/shared/page-intro";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { normalizeCnpj } from "@/features/parties/cnpj";
import { partyHref } from "@/features/parties/documents";
import { formatSearchKey } from "@/features/trackings/format";
import { useSupportView } from "@/features/settings/support-view";
import { useDemoStore } from "@/lib/demo-store";
import { formatDateTime, formatNumber } from "@/lib/format";

import { QUERY_MODES } from "../modes";
import { asyncStatusLabel, deliveryLabels, syncOutcomeLabels } from "../status";
import { isQueryOpen, type QueryView } from "../types";

type FlowFilter = "all" | QueryView["flow"];

export function QueriesPage({ queries }: { queries: QueryView[] }) {
  const { parties } = useDemoStore();
  const [supportView] = useSupportView();
  // Pelo documento, e não pelo partyId: uma consulta feita antes de salvar a
  // parte não tem partyId, mas a parte pode ter sido salva depois.
  const partyByDocument = new Map(
    parties.map((p) => [`${p.documentType}:${p.document}`, p]),
  );
  const partyOf = (q: QueryView) =>
    partyByDocument.get(`${q.searchType}:${q.searchKey}`);
  const [flow, setFlow] = useState<FlowFilter>("all");
  const [query, setQuery] = useState("");

  const term = query.trim().toLowerCase();
  // Letras e dígitos: serve para CNPJ e para CPF.
  const documentTerm = normalizeCnpj(term);
  const filtered = queries.filter((q) => {
    if (flow !== "all" && q.flow !== flow) return false;
    if (!term) return true;
    const party = partyOf(q);
    return (
      (documentTerm.length > 0 && q.searchKey.includes(documentTerm)) ||
      !!party?.name?.toLowerCase().includes(term)
    );
  });

  const open = queries.filter(isQueryOpen).length;
  const problems = queries.filter(
    (q) => q.syncOutcome === "failed" || q.syncOutcome === "uncertain",
  ).length;
  const tiles = [
    { label: "Consultas", value: queries.length },
    {
      label: "Síncronas",
      value: queries.filter((q) => q.flow === "sync").length,
    },
    { label: "Assíncronas em andamento", value: open },
    { label: "Com erro ou sem resposta", value: problems },
  ];

  return (
    <>
      <PageIntro description="Consultas feitas à JUDIT a partir das empresas. A síncrona responde na hora; a assíncrona termina depois, e o status muda quando você verifica ou quando a JUDIT avisa." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((tile) => (
          <div
            key={tile.label}
            className="flex flex-col gap-1 rounded-xl bg-card p-3 ring-1 ring-foreground/10"
          >
            <span className="text-xs text-muted-foreground">{tile.label}</span>
            <span className="text-xl font-semibold tabular-nums">
              {formatNumber(tile.value)}
            </span>
          </div>
        ))}
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
              placeholder="Buscar por nome, CNPJ ou CPF"
              aria-label="Buscar consultas"
              className="pl-8"
            />
          </div>
          <ToggleGroup
            variant="outline"
            spacing={0}
            size="sm"
            value={[flow]}
            onValueChange={(v) => v[0] && setFlow(v[0] as FlowFilter)}
            aria-label="Tipo de consulta"
            className="lg:ml-auto"
          >
            <ToggleGroupItem value="all">Todas</ToggleGroupItem>
            <ToggleGroupItem value="sync">Síncronas</ToggleGroupItem>
            <ToggleGroupItem value="async">Assíncronas</ToggleGroupItem>
          </ToggleGroup>
        </div>
        <CardContent className="px-2">
          {filtered.length === 0 ? (
            <EmptyState
              icon={FileSearchIcon}
              title={
                queries.length === 0
                  ? "Nenhuma consulta ainda"
                  : "Nenhuma consulta corresponde aos filtros"
              }
              description={
                queries.length === 0
                  ? "As consultas são feitas na página de cada empresa e aparecem aqui."
                  : "Ajuste a busca ou o tipo."
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Data</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Modalidade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Resultado</TableHead>
                  {supportView && <TableHead>Canal</TableHead>}
                  {supportView && <TableHead>request_id</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((q) => {
                  const party = partyOf(q);
                  const status =
                    q.flow === "async"
                      ? asyncStatusLabel(q.asyncStatus ?? "")
                      : syncOutcomeLabels[q.syncOutcome ?? "ok"];
                  return (
                    <TableRow key={q.id}>
                      <TableCell className="text-muted-foreground tabular-nums">
                        {formatDateTime(q.createdAt)}
                      </TableCell>
                      <TableCell className="max-w-56">
                        {/* Sem parte salva (consulta feita antes de
                            salvar, que falhou), não há página para abrir. */}
                        {party ? (
                          <Link
                            href={partyHref(party.documentType, party.document)}
                            className="block truncate rounded-sm underline-offset-4 outline-none hover:text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
                            title={party.name ?? undefined}
                          >
                            {party.name ?? (
                              <span className="font-mono text-xs">
                                {formatSearchKey(q.searchType, q.searchKey)}
                              </span>
                            )}
                          </Link>
                        ) : (
                          <span className="font-mono text-xs text-muted-foreground">
                            {formatSearchKey(q.searchType, q.searchKey)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>{QUERY_MODES[q.mode].label}</TableCell>
                      <TableCell>
                        <StatusBadge tone={status.tone}>
                          {status.label}
                        </StatusBadge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <QueryResult query={q} />
                      </TableCell>
                      {supportView && (
                        <TableCell className="text-xs text-muted-foreground">
                          {q.delivery
                            ? deliveryLabels[q.delivery]
                            : "resposta na chamada"}
                        </TableCell>
                      )}
                      {supportView && (
                        <TableCell>
                          <RequestIdCell query={q} />
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}

// Página do que foi consultado: a parte (empresa ou pessoa) ou o processo.
function targetHref(query: QueryView): string {
  return query.searchType === "cnj"
    ? `/processos/${query.searchKey}`
    : partyHref(query.searchType, query.searchKey);
}

// O que a consulta trouxe, em palavras. Os dados em si não ficam guardados:
// a assíncrona é lida na JUDIT pela página da empresa.
function QueryResult({ query }: { query: QueryView }) {
  if (query.flow === "async") {
    if (query.asyncStatus === "completed") {
      return (
        <Link
          href={targetHref(query)}
          className="text-primary underline-offset-4 hover:underline"
        >
          Ver na empresa
        </Link>
      );
    }
    return isQueryOpen(query) ? (
      <Link
        href={targetHref(query)}
        className="underline-offset-4 hover:text-primary hover:underline"
      >
        Verificar status na empresa
      </Link>
    ) : (
      "—"
    );
  }
  if (query.syncOutcome !== "ok" || query.resultCount === null) return "—";
  if (query.mode === "registration_data") {
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

function RequestIdCell({ query }: { query: QueryView }) {
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
