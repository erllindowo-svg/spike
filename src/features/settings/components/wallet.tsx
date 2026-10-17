"use client";

import { FlaskConicalIcon, WalletIcon } from "lucide-react";

import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatNumber } from "@/lib/format";

// A carteira do topo (círculo 5). No app real, abrir lê na JUDIT o consumo
// do ciclo e o saldo de créditos. No protótipo, uma leitura fictícia, sempre
// a mesma e marcada como tal.

const DEMO_CONSUMPTION = { consumption: 120, max: 1000 };

export function WalletButton() {
  const { consumption, max } = DEMO_CONSUMPTION;
  const percent = Math.min(100, (consumption / max) * 100);

  return (
    <Popover>
      <PopoverTrigger
        render={<Button variant="ghost" size="icon" aria-label="Carteira" />}
      >
        <WalletIcon />
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-80 flex-col gap-3">
        <PopoverTitle className="flex items-center gap-2">
          Carteira
          <StatusBadge tone="warning">
            <FlaskConicalIcon className="size-3" aria-hidden />
            Fictícia
          </StatusBadge>
        </PopoverTitle>
        <section className="flex flex-col gap-1.5 text-sm">
          <h3 className="font-medium">Consumo do ciclo</h3>
          <p>
            <span className="font-medium tabular-nums">
              {formatNumber(consumption)}
            </span>{" "}
            de {formatNumber(max)} consumidos · restam{" "}
            {formatNumber(max - consumption)}
          </p>
          <div
            className="h-2 w-full overflow-hidden rounded-full bg-muted"
            role="meter"
            aria-valuemin={0}
            aria-valuemax={max}
            aria-valuenow={consumption}
            aria-label="Consumo do ciclo"
          >
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${percent}%` }}
            />
          </div>
        </section>
        <p className="text-xs text-muted-foreground">
          Leitura fictícia: o protótipo não consulta a conta na JUDIT.
        </p>
      </PopoverContent>
    </Popover>
  );
}
