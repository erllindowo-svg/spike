"use client";

import {
  Building2Icon,
  PlusIcon,
  RadarIcon,
  SearchIcon,
  UserIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { EmptyState } from "@/components/shared/empty-state";
import { PageIntro } from "@/components/shared/page-intro";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
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
import { useNewTrackingDialog } from "@/features/trackings/components/new-tracking-dialog";
import { isTrackingClosed } from "@/features/trackings/types";
import { useDemoStore } from "@/lib/demo-store";
import { formatDate, formatNumber } from "@/lib/format";

import {
  displayDocument,
  DOCUMENTS,
  formatDocument,
  isValidDocument,
  normalizeDocument,
  partyHref,
  type DocumentType,
} from "../documents";
import { AddPartyDialog } from "./add-party-dialog";
import { RegistrationStatusBadge } from "./registration-status-badge";

export type PartyLawsuitSummary = Record<
  string,
  { total: number; active: number }
>;

// Lista de empresas (CNPJ) ou de pessoas físicas (CPF): a mesma tela, com os
// textos e o documento de cada tipo (documents.ts).
export function PartiesList({
  documentType,
  lawsuitSummary,
}: {
  documentType: DocumentType;
  lawsuitSummary: PartyLawsuitSummary;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { parties: allParties, trackings, dataSource } = useDemoStore();
  const { openNewTracking } = useNewTrackingDialog();
  const info = DOCUMENTS[documentType];
  const isCompany = documentType === "cnpj";
  const parties = allParties.filter((p) => p.documentType === documentType);
  // Adicionar sem monitorar só existe no modo "db": a demonstração tem uma
  // lista fixa de partes fictícias.
  const [adding, setAdding] = useState<{ document?: string } | null>(null);
  const queryParam = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(queryParam);
  const [syncedParam, setSyncedParam] = useState(queryParam);
  // Uma nova busca global (?q=) substitui o filtro digitado.
  if (queryParam !== syncedParam) {
    setSyncedParam(queryParam);
    setQuery(queryParam);
  }

  const term = query.trim().toLowerCase();
  const documentTerm = normalizeDocument(documentType, term);
  const filtered = parties.filter(
    (p) =>
      !term ||
      p.name?.toLowerCase().includes(term) ||
      (documentTerm.length > 0 && p.document.includes(documentTerm)),
  );
  const trackedDocuments = new Set(
    trackings
      .filter((t) => t.searchType === documentType && !isTrackingClosed(t))
      .map((t) => t.searchKey),
  );
  const canAddQuery =
    isValidDocument(documentType, term) &&
    !parties.some((p) => p.document === documentTerm);
  const EmptyIcon = isCompany ? Building2Icon : UserIcon;

  return (
    <>
      <PageIntro
        description={
          isCompany
            ? "Empresas que você adicionou ou monitora. Abra uma empresa para consultar os processos e ver os monitoramentos vinculados."
            : "Pessoas físicas que você adicionou ou monitora. O CPF aparece mascarado na lista; completo, só na página da pessoa."
        }
      >
        {dataSource === "db" && (
          <Button variant="outline" onClick={() => setAdding({})}>
            <PlusIcon data-icon="inline-start" />
            Adicionar {isCompany ? "empresa" : "pessoa"}
          </Button>
        )}
        <Button onClick={() => openNewTracking({ searchType: documentType })}>
          <RadarIcon data-icon="inline-start" />
          Monitorar {info.label}
        </Button>
      </PageIntro>

      <Card className="gap-0 py-0">
        <div className="flex flex-col gap-2 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-sm">
            <SearchIcon
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Buscar por ${isCompany ? "razão social" : "nome"} ou ${info.label}`}
              aria-label={`Buscar ${info.partyLabelPlural.toLowerCase()}`}
              className="pl-8"
            />
          </div>
          <span className="text-sm text-muted-foreground">
            {formatNumber(filtered.length)} de {formatNumber(parties.length)}{" "}
            {info.partyLabelPlural.toLowerCase()}
          </span>
        </div>
        <CardContent className="px-2">
          {filtered.length === 0 ? (
            <EmptyState
              icon={EmptyIcon}
              title={
                parties.length === 0 && !term
                  ? `Nenhuma ${isCompany ? "empresa" : "pessoa"} na lista`
                  : `Nenhuma ${isCompany ? "empresa" : "pessoa"} encontrada`
              }
              description={
                canAddQuery
                  ? dataSource === "db"
                    ? `O ${info.label} ${formatDocument(documentType, documentTerm)} ainda não está na lista. Adicione (com ou sem consulta aos dados cadastrais) ou comece a monitorar.`
                    : `Este ${info.label} não está nos dados de demonstração.`
                  : term
                    ? `Tente outro nome ou um ${info.label} completo.`
                    : `Adicione um ${info.label} ou crie um monitoramento para ele entrar na lista.`
              }
              action={
                canAddQuery ? (
                  <div className="flex flex-wrap justify-center gap-2">
                    {dataSource === "db" && (
                      <Button
                        onClick={() => setAdding({ document: documentTerm })}
                      >
                        <PlusIcon data-icon="inline-start" />
                        Adicionar {isCompany ? "empresa" : "pessoa"}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      onClick={() =>
                        openNewTracking({
                          searchType: documentType,
                          searchKey: documentTerm,
                        })
                      }
                    >
                      <RadarIcon data-icon="inline-start" />
                      Monitorar
                    </Button>
                  </div>
                ) : term ? (
                  <Button variant="outline" onClick={() => setQuery("")}>
                    Limpar busca
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>{isCompany ? "Razão social" : "Nome"}</TableHead>
                  <TableHead>{info.label}</TableHead>
                  <TableHead>Situação cadastral</TableHead>
                  <TableHead className="text-right">Processos</TableHead>
                  <TableHead className="text-right">Em andamento</TableHead>
                  <TableHead>Monitoramento</TableHead>
                  <TableHead className="text-right">Adicionada em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((party) => {
                  const summary = lawsuitSummary[party.id] ?? {
                    total: 0,
                    active: 0,
                  };
                  const href = partyHref(documentType, party.document);
                  return (
                    <TableRow
                      key={party.id}
                      className="cursor-pointer"
                      onClick={() => router.push(href)}
                    >
                      <TableCell className="max-w-72">
                        <Link
                          href={href}
                          onClick={(e) => e.stopPropagation()}
                          className="block truncate rounded-sm font-medium outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring/50"
                        >
                          {party.name ?? (
                            <span className="font-normal text-muted-foreground italic">
                              {isCompany
                                ? "Razão social não consultada"
                                : "Nome não consultado"}
                            </span>
                          )}
                        </Link>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {displayDocument(documentType, party.document)}
                      </TableCell>
                      <TableCell>
                        <RegistrationStatusBadge
                          status={party.registrationStatus}
                        />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(summary.total)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground tabular-nums">
                        {formatNumber(summary.active)}
                      </TableCell>
                      <TableCell>
                        {trackedDocuments.has(party.document) ? (
                          <StatusBadge tone="success">
                            Por {info.label}
                          </StatusBadge>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            —
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground tabular-nums">
                        {formatDate(party.createdAt)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AddPartyDialog
        documentType={documentType}
        open={adding !== null}
        onOpenChange={(open) => !open && setAdding(null)}
        defaultDocument={adding?.document}
      />
    </>
  );
}
