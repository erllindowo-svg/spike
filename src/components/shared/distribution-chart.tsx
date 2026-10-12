import type { DistributionDatum } from "@/features/processes/types";
import { formatNumber } from "@/lib/format";

// Barras horizontais simples: cada linha traz rótulo, quantidade e percentual.
export function DistributionChart({
  data,
  label,
  maxItems = 6,
}: {
  data: DistributionDatum[];
  label: string;
  maxItems?: number;
}) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const visible = data.slice(0, maxItems);
  const others = data.slice(maxItems).reduce((sum, d) => sum + d.value, 0);
  const rows = others
    ? [...visible, { label: "Outros", value: others }]
    : visible;
  const max = Math.max(...rows.map((r) => r.value), 1);

  if (total === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Nenhum processo para distribuir.
      </p>
    );
  }

  return (
    <figure className="flex flex-col gap-3">
      <figcaption className="sr-only">{label}</figcaption>
      <ul className="flex flex-col gap-2.5">
        {rows.map((row) => {
          const percent = Math.round((row.value / total) * 100);
          return (
            <li
              key={row.label}
              className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-sm"
            >
              <span className="truncate text-foreground" title={row.label}>
                {row.label}
              </span>
              <span
                className="h-2 overflow-hidden rounded-full bg-muted"
                aria-hidden
              >
                <span
                  className="block h-full rounded-full bg-primary/80"
                  style={{ width: `${(row.value / max) * 100}%` }}
                />
              </span>
              <span className="w-20 text-right text-muted-foreground tabular-nums">
                <span className="font-medium text-foreground">
                  {formatNumber(row.value)}
                </span>{" "}
                · {percent}%
              </span>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted-foreground">
        Total de {formatNumber(total)} processos. Contagem por {label}, sem
        qualquer avaliação de mérito ou risco.
      </p>
    </figure>
  );
}
