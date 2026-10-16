"use client";

import { ChevronLeftIcon, ChevronRightIcon, InfoIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/format";

// Paginação no navegador das listas que a página já tem inteiras (o limite
// do que é lido do banco fica em src/lib/list-limits.ts).

const PAGE_SIZE = 25;

export type Paged<T> = {
  items: T[];
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  setPage: (page: number) => void;
};

// `resetKey` resume os filtros: quando muda, a lista volta à primeira
// página (ajuste de estado durante a renderização, sem efeito).
export function usePaged<T>(
  items: T[],
  resetKey: string,
  pageSize = PAGE_SIZE,
): Paged<T> {
  const [state, setState] = useState({ page: 0, key: resetKey });
  let page = state.page;
  if (state.key !== resetKey) {
    setState({ page: 0, key: resetKey });
    page = 0;
  }
  const bounds = pageWindow(items.length, page, pageSize);
  return {
    items: items.slice(bounds.start, bounds.end),
    page: bounds.page,
    pageCount: bounds.pageCount,
    total: items.length,
    pageSize,
    setPage: (next) => setState({ page: next, key: resetKey }),
  };
}

// A página pedida é ajustada ao intervalo válido: se a lista encolheu (um
// item foi apagado, por exemplo), mostra a última página que existe.
export function pageWindow(
  total: number,
  page: number,
  pageSize: number,
): { page: number; pageCount: number; start: number; end: number } {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(page, 0), pageCount - 1);
  const start = current * pageSize;
  return {
    page: current,
    pageCount,
    start,
    end: Math.min(start + pageSize, total),
  };
}

export function ListPagination<T>({ paged }: { paged: Paged<T> }) {
  if (paged.pageCount <= 1) return null;
  const first = paged.page * paged.pageSize + 1;
  const last = Math.min(first + paged.pageSize - 1, paged.total);
  return (
    <nav
      aria-label="Paginação"
      className="flex items-center justify-between gap-2 border-t px-4 py-3 text-sm text-muted-foreground"
    >
      <span>
        {formatNumber(first)}–{formatNumber(last)} de{" "}
        {formatNumber(paged.total)}
      </span>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={paged.page === 0}
          onClick={() => paged.setPage(paged.page - 1)}
        >
          <ChevronLeftIcon data-icon="inline-start" />
          Anterior
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={paged.page >= paged.pageCount - 1}
          onClick={() => paged.setPage(paged.page + 1)}
        >
          Próxima
          <ChevronRightIcon data-icon="inline-end" />
        </Button>
      </div>
    </nav>
  );
}

// Aviso de que a lista chegou ao limite lido do banco.
export function LimitNotice({
  reached,
  limit,
  what,
}: {
  reached: boolean;
  limit: number;
  what: string;
}) {
  if (!reached) return null;
  return (
    <p className="flex items-center gap-2 border-t px-4 py-3 text-xs text-muted-foreground">
      <InfoIcon className="size-3.5 shrink-0" aria-hidden />
      Mostrando {what} mais recentes (até {formatNumber(limit)}). Registros mais
      antigos continuam no banco, mas não aparecem aqui.
    </p>
  );
}
