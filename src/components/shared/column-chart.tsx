"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatNumber } from "@/lib/format";

// Colunas de uma série só (ex.: alertas por dia). Uma cor, a primária; colunas
// de até 24px com a ponta arredondada e a base reta; a dica abre ao passar o
// mouse ou ao focar pelo teclado, e a tabela escondida dá os mesmos valores
// a quem usa leitor de tela.

export type ColumnDatum = {
  key: string;
  // Rótulo curto do eixo (ex.: "16/10").
  label: string;
  value: number;
};

export function ColumnChart({
  data,
  label,
  unit,
}: {
  data: ColumnDatum[];
  // Do que é o gráfico, para a legenda acessível e a tabela.
  label: string;
  // Plural do que é contado ("alertas").
  unit: string;
}) {
  const top = Math.max(1, ...data.map((d) => d.value));
  // Três rótulos no eixo: o primeiro dia, o do meio e o último.
  const axisLabels =
    data.length > 2
      ? [data[0], data[Math.floor((data.length - 1) / 2)], data.at(-1)!]
      : data;

  return (
    <figure className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1.5">
      <figcaption className="sr-only">{label}</figcaption>
      <div
        className="flex h-36 flex-col justify-between text-right text-xs text-muted-foreground tabular-nums"
        aria-hidden
      >
        <span>{formatNumber(top)}</span>
        <span>0</span>
      </div>
      <div className="relative h-36 border-t border-b border-border/70">
        <div className="absolute inset-0 flex items-end gap-0.5">
          {data.map((d) => (
            <Tooltip key={d.key}>
              <TooltipTrigger
                render={
                  <div
                    tabIndex={0}
                    aria-label={`${formatNumber(d.value)} ${unit} em ${d.label}`}
                    className="group flex h-full flex-1 items-end justify-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  />
                }
              >
                <span
                  className="block w-full max-w-6 rounded-t-[4px] bg-primary/75 transition-colors group-hover:bg-primary group-focus-visible:bg-primary"
                  style={{ height: `${(d.value / top) * 100}%` }}
                />
              </TooltipTrigger>
              <TooltipContent>
                <span className="font-semibold tabular-nums">
                  {formatNumber(d.value)}
                </span>{" "}
                {unit} · {d.label}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>
      <span aria-hidden />
      <div
        className="flex justify-between text-xs text-muted-foreground tabular-nums"
        aria-hidden
      >
        {axisLabels.map((d) => (
          <span key={d.key}>{d.label}</span>
        ))}
      </div>
      <table className="sr-only">
        <caption>{label}</caption>
        <thead>
          <tr>
            <th scope="col">Dia</th>
            <th scope="col">{unit}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.key}>
              <td>{d.label}</td>
              <td>{d.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
