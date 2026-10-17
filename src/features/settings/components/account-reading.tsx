import { Fragment } from "react";

import type { AccountResult } from "@/features/settings/account-actions";
import { formatDate, formatNumber } from "@/lib/format";
import type { BillingConsumption } from "@/lib/judit/account";

// A leitura da conta na JUDIT (consumo do ciclo e saldo de créditos), igual
// no cartão das Configurações e na carteira do topo (círculo 5).
export function AccountReading({
  result,
}: {
  result: Extract<AccountResult, { ok: true }>;
}) {
  return (
    <div className="flex flex-col gap-4 text-sm">
      <section className="flex flex-col gap-1.5">
        <h3 className="font-medium">Consumo do ciclo</h3>
        {result.consumption.ok ? (
          <ConsumptionView value={result.consumption.value} />
        ) : (
          <p className="text-muted-foreground">{result.consumption.message}</p>
        )}
      </section>
      <section className="flex flex-col gap-1.5">
        <h3 className="font-medium">Saldo de créditos</h3>
        {result.balance.ok ? (
          result.balance.value.length > 0 ? (
            <dl className="grid grid-cols-[minmax(0,12rem)_1fr] gap-x-3 gap-y-1">
              {result.balance.value.map(([key, value]) => (
                <Fragment key={key}>
                  <dt className="truncate font-mono text-xs text-muted-foreground">
                    {key}
                  </dt>
                  <dd className="tabular-nums">{value}</dd>
                </Fragment>
              ))}
            </dl>
          ) : (
            <p className="text-muted-foreground">
              A JUDIT respondeu sem campos simples.
            </p>
          )
        ) : (
          <p className="text-muted-foreground">{result.balance.message}</p>
        )}
      </section>
    </div>
  );
}

function ConsumptionView({ value }: { value: BillingConsumption }) {
  const { consumption, max_consumption: max, remaining } = value;
  if (consumption === undefined || max === undefined) {
    return (
      <p className="text-muted-foreground">A resposta veio sem os totais.</p>
    );
  }
  const percent = max > 0 ? Math.min(100, (consumption / max) * 100) : 0;
  const cycle =
    value.cycle_started_at && value.cycle_ended_at
      ? `Ciclo de ${formatDate(new Date(value.cycle_started_at))} a ${formatDate(new Date(value.cycle_ended_at))}.`
      : null;
  return (
    <div className="flex flex-col gap-1.5">
      <p>
        <span className="font-medium tabular-nums">
          {formatNumber(consumption)}
        </span>{" "}
        de {formatNumber(max)} consumidos
        {remaining !== undefined && ` · restam ${formatNumber(remaining)}`}
      </p>
      <div
        className="h-2 w-full max-w-md overflow-hidden rounded-full bg-muted"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={consumption}
        aria-label="Consumo do ciclo"
      >
        <div
          className="h-full rounded-full bg-primary/80"
          style={{ width: `${percent}%` }}
        />
      </div>
      {cycle && <p className="text-xs text-muted-foreground">{cycle}</p>}
    </div>
  );
}
