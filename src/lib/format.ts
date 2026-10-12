// Fuso explícito para que servidor e navegador produzam o mesmo texto.
const TIME_ZONE = "America/Sao_Paulo";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const preciseFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

const shortFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TIME_ZONE,
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const timeFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
});

const numberFormatter = new Intl.NumberFormat("pt-BR");

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export const NOT_AVAILABLE = "Não informado";

export function formatDate(date: Date | null): string {
  return date ? dateFormatter.format(date) : NOT_AVAILABLE;
}

export function formatDateTime(date: Date | null): string {
  return date ? dateTimeFormatter.format(date) : NOT_AVAILABLE;
}

export function formatPreciseDateTime(date: Date | null): string {
  return date ? preciseFormatter.format(date) : NOT_AVAILABLE;
}

export function formatShortDateTime(date: Date): string {
  return shortFormatter.format(date).replace(".", "");
}

export function formatTime(date: Date): string {
  return timeFormatter.format(date);
}

export function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

export function formatCurrency(value: number | null): string {
  return value === null ? NOT_AVAILABLE : currencyFormatter.format(value);
}

export function formatDuration(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} s`;
}
