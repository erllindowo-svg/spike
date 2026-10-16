"use client";

import { CloudDownloadIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import type { SearchPartyLawsuitsResult } from "@/features/processes/actions";
import { LawsuitsTable } from "@/features/processes/components/lawsuits-table";
import type { Lawsuit } from "@/features/processes/types";
import { QUERY_MODES } from "@/features/queries/modes";
import { formatDateTime, formatNumber, lowerFirst } from "@/lib/format";

import type { DocumentInfo } from "../documents";

export type JuditSearch = Extract<SearchPartyLawsuitsResult, { ok: true }>;

const SYNC_LABEL = QUERY_MODES.datalake_sync.label;

// "Processos associados" da página da parte: a consulta síncrona (cobrada,
// por clique) no modo "db", ou os processos fictícios na demonstração. O
// resultado fica no estado de PartyDetail, porque os indicadores do topo da
// página também o usam.
export function PartyLawsuitsCard({
  info,
  fromJudit,
  lawsuits,
  judit,
  searching,
  supportView,
  onSearch,
  onSelect,
}: {
  info: DocumentInfo;
  fromJudit: boolean;
  lawsuits: Lawsuit[];
  judit: JuditSearch | null;
  searching: boolean;
  supportView: boolean;
  onSearch: () => void;
  onSelect: (lawsuit: Lawsuit) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Processos associados</CardTitle>
        <CardDescription>
          {!fromJudit
            ? "Selecione um processo para ver detalhes e movimentações."
            : judit
              ? `${SYNC_LABEL} à JUDIT feita em ${formatDateTime(judit.fetchedAt)}${supportView && judit.requestId ? ` · request_id ${judit.requestId}` : ""}. Os processos não ficam salvos: recarregar a página limpa a lista (a consulta fica no histórico, em Consultas).`
              : "Os processos vêm de uma consulta síncrona à JUDIT. Cada consulta é cobrada."}
        </CardDescription>
        <CardAction className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground tabular-nums">
            {formatNumber(lawsuits.length)} processos
          </span>
          {fromJudit && (
            <Button
              variant="outline"
              size="sm"
              onClick={onSearch}
              disabled={searching}
            >
              {searching ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <CloudDownloadIcon data-icon="inline-start" />
              )}
              Fazer {lowerFirst(SYNC_LABEL)}
            </Button>
          )}
        </CardAction>
      </CardHeader>
      <CardContent>
        {judit && judit.total > judit.lawsuits.length && (
          <p className="mb-3 text-sm text-muted-foreground">
            Mostrando {formatNumber(judit.lawsuits.length)} de{" "}
            {formatNumber(judit.total)} processos: a consulta síncrona devolve
            tudo de uma vez, e a tela mostra só os primeiros para não travar.
          </p>
        )}
        <LawsuitsTable
          lawsuits={lawsuits}
          onSelect={onSelect}
          emptyDescription={
            fromJudit
              ? judit
                ? `A consulta síncrona não retornou processos para este ${info.label}.`
                : `Clique em “Fazer ${lowerFirst(SYNC_LABEL)}” para buscar os processos.`
              : undefined
          }
        />
      </CardContent>
    </Card>
  );
}
