"use client";

import {
  Building2Icon,
  EllipsisIcon,
  PauseIcon,
  PlayIcon,
  ScaleIcon,
  WebhookIcon,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatSearchKey,
  getLastEventByReference,
} from "@/features/trackings/format";
import {
  formatRecurrence,
  getTrackingDisplayState,
  searchTypeDescriptions,
  type Tracking,
} from "@/features/trackings/types";
import { useDemoStore } from "@/lib/demo-store";
import { formatDate, formatDateTime } from "@/lib/format";

import { SearchTypeBadge } from "./search-type-badge";
import { TrackingStatusBadge } from "./tracking-status-badge";

export function TrackingsTable({
  trackings,
  variant = "full",
}: {
  trackings: Tracking[];
  variant?: "full" | "compact";
}) {
  const { getCompany, lawsuits, webhookEvents, setTrackingPaused, dataSource } =
    useDemoStore();
  const lastEvents = getLastEventByReference(webhookEvents);
  const full = variant === "full";

  function identifierHref(tracking: Tracking): string | null {
    if (tracking.searchType === "cnpj") {
      return tracking.companyId ? `/empresas/${tracking.searchKey}` : null;
    }
    return lawsuits.some((l) => l.cnj === tracking.searchKey)
      ? `/processos/${tracking.searchKey}`
      : null;
  }

  function togglePause(tracking: Tracking, paused: boolean) {
    setTrackingPaused(tracking.id, paused);
    toast.success(paused ? "Monitoramento pausado" : "Monitoramento retomado", {
      description: "Alteração apenas local. Nenhuma chamada foi feita à JUDIT.",
    });
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Identificador</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead className={full ? undefined : "hidden lg:table-cell"}>
            Empresa
          </TableHead>
          {full && <TableHead>Recorrência</TableHead>}
          <TableHead>Status</TableHead>
          {full && <TableHead>Criado em</TableHead>}
          <TableHead className="text-right">
            {full ? "Último evento" : "Atualizado em"}
          </TableHead>
          {full && (
            <TableHead className="w-10">
              <span className="sr-only">Ações</span>
            </TableHead>
          )}
        </TableRow>
      </TableHeader>
      <TableBody>
        {trackings.map((tracking) => {
          const company = getCompany(tracking.companyId);
          const href = identifierHref(tracking);
          const identifier = formatSearchKey(
            tracking.searchType,
            tracking.searchKey,
          );
          const lastEvent = tracking.juditTrackingId
            ? lastEvents.get(tracking.juditTrackingId)
            : undefined;
          const state = getTrackingDisplayState(tracking.status);

          return (
            <TableRow key={tracking.id}>
              <TableCell className="font-mono text-xs">
                {href ? (
                  <Link
                    href={href}
                    className="rounded-sm text-foreground underline-offset-4 outline-none hover:text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    {identifier}
                  </Link>
                ) : (
                  identifier
                )}
                {full && !tracking.juditTrackingId && (
                  <span className="mt-0.5 block font-sans text-[11px] text-muted-foreground">
                    Criado localmente (sem ID da JUDIT)
                  </span>
                )}
              </TableCell>
              <TableCell>
                <span title={searchTypeDescriptions[tracking.searchType]}>
                  <SearchTypeBadge type={tracking.searchType} />
                </span>
              </TableCell>
              <TableCell
                className={
                  full
                    ? "max-w-44 truncate"
                    : "hidden max-w-48 truncate lg:table-cell"
                }
              >
                {company ? (
                  <span title={company.legalName ?? undefined}>
                    {company.legalName ?? (
                      <span className="text-muted-foreground">
                        Razão social indisponível
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              {full && (
                <TableCell className="text-muted-foreground">
                  {formatRecurrence(tracking.recurrenceDays)}
                </TableCell>
              )}
              <TableCell>
                <TrackingStatusBadge status={tracking.status} />
              </TableCell>
              {full && (
                <TableCell className="text-muted-foreground tabular-nums">
                  {formatDate(tracking.createdAt)}
                </TableCell>
              )}
              <TableCell className="text-right text-muted-foreground tabular-nums">
                {full
                  ? lastEvent
                    ? formatDateTime(lastEvent)
                    : "Nenhum evento"
                  : formatDateTime(tracking.updatedAt)}
              </TableCell>
              {full && (
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Ações para ${identifier}`}
                        />
                      }
                    >
                      <EllipsisIcon />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52">
                      {company && (
                        <DropdownMenuItem
                          render={<Link href={`/empresas/${company.cnpj}`} />}
                        >
                          <Building2Icon />
                          Ver empresa
                        </DropdownMenuItem>
                      )}
                      {tracking.searchType === "cnj" && href && (
                        <DropdownMenuItem render={<Link href={href} />}>
                          <ScaleIcon />
                          Ver processo
                        </DropdownMenuItem>
                      )}
                      {tracking.juditTrackingId ? (
                        <DropdownMenuItem
                          render={
                            <Link
                              href={`/webhooks?referencia=${tracking.juditTrackingId}`}
                            />
                          }
                        >
                          <WebhookIcon />
                          Ver eventos recebidos
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem disabled>
                          <WebhookIcon />
                          Sem eventos (item local)
                        </DropdownMenuItem>
                      )}
                      {/* Pausar de verdade depende da JUDIT (etapa 4). */}
                      {dataSource === "demo" &&
                        (state === "active" || state === "paused") && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() =>
                                togglePause(tracking, state === "active")
                              }
                            >
                              {state === "active" ? (
                                <PauseIcon />
                              ) : (
                                <PlayIcon />
                              )}
                              {state === "active"
                                ? "Pausar (demonstração)"
                                : "Retomar (demonstração)"}
                            </DropdownMenuItem>
                          </>
                        )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              )}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
