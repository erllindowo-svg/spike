import type { DistributionDatum } from "@/features/processes/types";
import { QUERY_MODES } from "@/features/queries/modes";
import type { QueryView } from "@/features/queries/types";
import {
  getTrackingDisplayState,
  trackingDisplayLabels,
  type Tracking,
  type TrackingDisplayState,
} from "@/features/trackings/types";

// Contagens do Dashboard. Funções puras: recebem as listas que a tela já tem
// e não leem o relógio (a data de referência vem de fora, igual no servidor
// e no navegador).

const DAY_MS = 24 * 60 * 60 * 1000;

// Dia no fuso do app (o mesmo de src/lib/format.ts), para que um alerta das
// 22h não caia no dia seguinte por causa do UTC.
const dayKey = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const dayLabel = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
});

export type DayCount = {
  key: string;
  // "16/10"
  label: string;
  count: number;
};

// Quantos itens por dia, nos `days` dias que terminam em `reference`
// (inclusive), do mais antigo para o mais novo. Dias sem itens valem zero.
export function countPerDay(
  dates: Date[],
  reference: Date,
  days: number,
): DayCount[] {
  const counts = new Map<string, number>();
  for (const date of dates) {
    const key = dayKey.format(date);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(reference.getTime() - (days - 1 - index) * DAY_MS);
    const key = dayKey.format(date);
    return { key, label: dayLabel.format(date), count: counts.get(key) ?? 0 };
  });
}

// Monitoramentos por situação, só as situações que têm algum.
export function countTrackingsByState(
  trackings: Tracking[],
): DistributionDatum[] {
  const counts = new Map<TrackingDisplayState, number>();
  for (const tracking of trackings) {
    const state = getTrackingDisplayState(tracking);
    counts.set(state, (counts.get(state) ?? 0) + 1);
  }
  return sortDesc(
    [...counts].map(([state, value]) => ({
      label: trackingDisplayLabels[state],
      value,
    })),
  );
}

// Consultas por modalidade (síncrona, dados cadastrais, assíncrona...).
export function countQueriesByMode(queries: QueryView[]): DistributionDatum[] {
  const counts = new Map<QueryView["mode"], number>();
  for (const query of queries) {
    counts.set(query.mode, (counts.get(query.mode) ?? 0) + 1);
  }
  return sortDesc(
    [...counts].map(([mode, value]) => ({
      label: QUERY_MODES[mode].label,
      value,
    })),
  );
}

function sortDesc(data: DistributionDatum[]): DistributionDatum[] {
  return data.sort(
    (a, b) => b.value - a.value || a.label.localeCompare(b.label, "pt-BR"),
  );
}
