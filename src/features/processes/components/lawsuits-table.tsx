"use client";

import { ScaleIcon, SearchIcon } from "lucide-react";
import { useState } from "react";

import { EmptyState } from "@/components/shared/empty-state";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCnj, normalizeCnj } from "@/features/processes/cnj";
import {
  companyRoleLabels,
  lawsuitStatusLabels,
  type Lawsuit,
} from "@/features/processes/types";
import { formatDate, NOT_AVAILABLE } from "@/lib/format";

import { LawsuitStatusBadge } from "./lawsuit-status-badge";

const statusItems = [
  { value: "all", label: "Todos os status" },
  ...Object.entries(lawsuitStatusLabels).map(([value, label]) => ({
    value,
    label,
  })),
];

export function LawsuitsTable({
  lawsuits,
  onSelect,
  emptyDescription = "Não há processos associados a este CNPJ nos dados de demonstração.",
}: {
  lawsuits: Lawsuit[];
  onSelect: (lawsuit: Lawsuit) => void;
  // Texto quando não há nenhum processo (muda conforme a origem dos dados).
  emptyDescription?: string;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");

  const term = query.trim().toLowerCase();
  const digits = normalizeCnj(term);
  const filtered = lawsuits.filter((l) => {
    if (status !== "all" && l.status !== status) return false;
    if (!term) return true;
    return (
      (digits.length > 0 && l.cnj.includes(digits)) ||
      [l.tribunal, l.area, l.className, l.subject].some((v) =>
        v?.toLowerCase().includes(term),
      )
    );
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <SearchIcon
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filtrar por número, tribunal, área ou classe"
            aria-label="Filtrar processos"
            className="pl-8"
          />
        </div>
        <Select
          items={statusItems}
          value={status}
          onValueChange={(v) => v && setStatus(v)}
        >
          <SelectTrigger className="w-full sm:w-48" aria-label="Status">
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

      {filtered.length === 0 ? (
        <EmptyState
          icon={ScaleIcon}
          title={
            lawsuits.length === 0
              ? "Nenhum processo encontrado"
              : "Nenhum processo corresponde aos filtros"
          }
          description={
            lawsuits.length === 0
              ? emptyDescription
              : "Ajuste a busca ou o filtro de status."
          }
          className="border"
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Número CNJ</TableHead>
              <TableHead>Tribunal</TableHead>
              <TableHead>Área / classe</TableHead>
              <TableHead>Papel da empresa</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Última movimentação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((lawsuit) => (
              <TableRow
                key={lawsuit.id}
                className="cursor-pointer"
                onClick={() => onSelect(lawsuit)}
              >
                <TableCell>
                  <button
                    type="button"
                    className="rounded-sm font-mono text-xs underline-offset-4 outline-none hover:text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(lawsuit);
                    }}
                  >
                    {formatCnj(lawsuit.cnj)}
                  </button>
                </TableCell>
                <TableCell>{lawsuit.tribunal}</TableCell>
                <TableCell className="max-w-64">
                  <div className="flex flex-col">
                    <span>{lawsuit.area ?? NOT_AVAILABLE}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {lawsuit.className ?? "Classe não informada"}
                    </span>
                  </div>
                </TableCell>
                <TableCell
                  className={
                    lawsuit.companyRole ? undefined : "text-muted-foreground"
                  }
                >
                  {lawsuit.companyRole
                    ? companyRoleLabels[lawsuit.companyRole]
                    : NOT_AVAILABLE}
                </TableCell>
                <TableCell>
                  <LawsuitStatusBadge status={lawsuit.status} />
                </TableCell>
                <TableCell className="text-right text-muted-foreground tabular-nums">
                  {formatDate(lawsuit.lastMovementAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
