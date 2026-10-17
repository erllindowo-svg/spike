"use client";

import { LockIcon, SparklesIcon } from "lucide-react";

import { DistributionChart } from "@/components/shared/distribution-chart";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { RecordOrigin } from "@/lib/models";
import { formatSearchKey, SEARCH_TYPES } from "@/features/consult/identify";
import { LawsuitsTable } from "@/features/processes/components/lawsuits-table";
import type { Lawsuit } from "@/features/processes/types";
import {
  QueryResult,
  RequestIdCell,
} from "@/features/queries/components/query-cells";
import { QUERY_MODES } from "@/features/queries/modes";
import type { QueryView } from "@/features/queries/types";
import { SupportOnly } from "@/features/settings/support-view";
import { formatDateTime, formatNumber } from "@/lib/format";

import type {
  SubjectLawsuit,
  SubjectRegistration,
  SubjectStats,
  SubjectWarrant,
} from "../view";

// Blocos do que já se sabe de um identificador, usados em dois lugares
// (círculo 3B): a ficha do Acervo (em cartões) e o "Já capturado" da página
// Consultar (em seções que abrem e fecham). Só desenham o que recebem.

const originLabels: Record<RecordOrigin, string> = {
  sync: "consulta síncrona",
  async: "consulta assíncrona",
  tracking: "monitoramento",
  webhook: "entrega por webhook",
};

export function Known({
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

export function RegistrationsList({
  registrations,
}: {
  registrations: SubjectRegistration[];
}) {
  return (
    <div className="flex flex-col gap-4">
      {registrations.map((r) => (
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
    </div>
  );
}

export function StatsBody({
  count,
  synthetic,
}: {
  count: SubjectStats | undefined;
  synthetic: SubjectStats | undefined;
}) {
  return (
    <div className="flex flex-col gap-4">
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
    </div>
  );
}

export function LawsuitsBody({
  lawsuits,
  onSelect,
  highlighted,
}: {
  lawsuits: SubjectLawsuit[];
  onSelect: (lawsuit: Lawsuit) => void;
  // CNJs com alerta não lido (só a ficha passa).
  highlighted?: ReadonlySet<string>;
}) {
  const secret = lawsuits.filter((l) => (l.secrecyLevel ?? 0) > 0).length;
  const aiSummary = lawsuits.find((l) => l.aiSummary)?.aiSummary ?? null;
  return (
    <div className="flex flex-col gap-3">
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
        onSelect={onSelect}
        emptyDescription="Nenhum processo guardado."
        highlighted={highlighted}
      />
    </div>
  );
}

export function WarrantsList({ warrants }: { warrants: SubjectWarrant[] }) {
  return (
    <ul className="flex flex-col divide-y text-sm">
      {warrants.map((w) => (
        <li key={w.code ?? w.number} className="flex flex-col gap-0.5 py-2.5">
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
  );
}

export function QueriesTable({ queries }: { queries: QueryView[] }) {
  return (
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
  );
}

export function lastFetch(lawsuits: SubjectLawsuit[]): Date | undefined {
  return lawsuits
    .map((l) => l.fetchedAt)
    .filter((d): d is Date => !!d)
    .sort((a, b) => b.getTime() - a.getTime())[0];
}
