"use client";

import { Building2Icon, PlusIcon, RadarIcon, SearchIcon } from "lucide-react";
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
import {
  formatCnpj,
  isValidCnpj,
  normalizeCnpj,
} from "@/features/companies/cnpj";
import { useNewTrackingDialog } from "@/features/trackings/components/new-tracking-dialog";
import { isTrackingClosed } from "@/features/trackings/types";
import { useDemoStore } from "@/lib/demo-store";
import { formatDate, formatNumber } from "@/lib/format";

import { RegistrationStatusBadge } from "./registration-status-badge";

export type CompanyLawsuitSummary = Record<
  string,
  { total: number; active: number }
>;

export function CompaniesList({
  lawsuitSummary,
}: {
  lawsuitSummary: CompanyLawsuitSummary;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { companies, trackings } = useDemoStore();
  const { openNewTracking } = useNewTrackingDialog();
  const queryParam = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(queryParam);
  const [syncedParam, setSyncedParam] = useState(queryParam);
  // Uma nova busca global (?q=) substitui o filtro digitado.
  if (queryParam !== syncedParam) {
    setSyncedParam(queryParam);
    setQuery(queryParam);
  }

  const term = query.trim().toLowerCase();
  const cnpjTerm = normalizeCnpj(term);
  const filtered = companies.filter(
    (c) =>
      !term ||
      c.legalName?.toLowerCase().includes(term) ||
      (cnpjTerm.length > 0 && c.cnpj.includes(cnpjTerm)),
  );
  const trackedCnpjs = new Set(
    trackings
      .filter((t) => t.searchType === "cnpj" && !isTrackingClosed(t))
      .map((t) => t.searchKey),
  );
  const canTrackQuery =
    isValidCnpj(term) && !companies.some((c) => c.cnpj === cnpjTerm);

  return (
    <>
      <PageIntro description="Empresas consultadas por CNPJ. Abra uma empresa para ver o panorama processual e os monitoramentos vinculados.">
        <Button onClick={() => openNewTracking({ searchType: "cnpj" })}>
          <PlusIcon data-icon="inline-start" />
          Monitorar CNPJ
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
              placeholder="Buscar por razão social ou CNPJ"
              aria-label="Buscar empresas"
              className="pl-8"
            />
          </div>
          <span className="text-sm text-muted-foreground">
            {formatNumber(filtered.length)} de {formatNumber(companies.length)}{" "}
            empresas
          </span>
        </div>
        <CardContent className="px-2">
          {filtered.length === 0 ? (
            <EmptyState
              icon={Building2Icon}
              title="Nenhuma empresa encontrada"
              description={
                canTrackQuery
                  ? "Este CNPJ não está nos dados de demonstração. A consulta real à JUDIT será habilitada na etapa de integração."
                  : "Tente outra razão social ou um CNPJ completo."
              }
              action={
                canTrackQuery ? (
                  <Button
                    variant="outline"
                    onClick={() =>
                      openNewTracking({
                        searchType: "cnpj",
                        searchKey: cnpjTerm,
                      })
                    }
                  >
                    <RadarIcon data-icon="inline-start" />
                    Monitorar {formatCnpj(cnpjTerm)}
                  </Button>
                ) : (
                  <Button variant="outline" onClick={() => setQuery("")}>
                    Limpar busca
                  </Button>
                )
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Razão social</TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Situação cadastral</TableHead>
                  <TableHead className="text-right">Processos</TableHead>
                  <TableHead className="text-right">Em andamento</TableHead>
                  <TableHead>Monitoramento</TableHead>
                  <TableHead className="text-right">Consultada em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((company) => {
                  const summary = lawsuitSummary[company.id] ?? {
                    total: 0,
                    active: 0,
                  };
                  const href = `/empresas/${company.cnpj}`;
                  return (
                    <TableRow
                      key={company.id}
                      className="cursor-pointer"
                      onClick={() => router.push(href)}
                    >
                      <TableCell className="max-w-72">
                        <Link
                          href={href}
                          onClick={(e) => e.stopPropagation()}
                          className="block truncate rounded-sm font-medium outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring/50"
                        >
                          {company.legalName ?? (
                            <span className="font-normal text-muted-foreground italic">
                              Razão social indisponível
                            </span>
                          )}
                        </Link>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {formatCnpj(company.cnpj)}
                      </TableCell>
                      <TableCell>
                        <RegistrationStatusBadge
                          status={company.registrationStatus}
                        />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(summary.total)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground tabular-nums">
                        {formatNumber(summary.active)}
                      </TableCell>
                      <TableCell>
                        {trackedCnpjs.has(company.cnpj) ? (
                          <StatusBadge tone="success">Por CNPJ</StatusBadge>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            —
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground tabular-nums">
                        {formatDate(company.createdAt)}
                      </TableCell>
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
