import { z } from "zod";

// Suporta o CNPJ numérico e o alfanumérico (IN RFB nº 2.229/2024): 12
// caracteres [0-9A-Z] seguidos de 2 dígitos verificadores numéricos.
const CNPJ_PATTERN = /^[0-9A-Z]{12}[0-9]{2}$/;
const WEIGHTS = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

export function normalizeCnpj(value: string): string {
  return value.toUpperCase().replace(/[^0-9A-Z]/g, "");
}

export function formatCnpj(value: string): string {
  return normalizeCnpj(value).replace(
    /^([0-9A-Z]{2})([0-9A-Z]{3})([0-9A-Z]{3})([0-9A-Z]{4})([0-9]{2})$/,
    "$1.$2.$3/$4-$5",
  );
}

function checkDigit(base: string): number {
  const weights = WEIGHTS.slice(WEIGHTS.length - base.length);
  const sum = [...base].reduce(
    (acc, char, i) => acc + (char.charCodeAt(0) - 48) * weights[i],
    0,
  );
  const rest = sum % 11;
  return rest < 2 ? 0 : 11 - rest;
}

export function isValidCnpj(value: string): boolean {
  const cnpj = normalizeCnpj(value);
  if (!CNPJ_PATTERN.test(cnpj) || /^(.)\1{13}$/.test(cnpj)) return false;

  const first = checkDigit(cnpj.slice(0, 12));
  const second = checkDigit(cnpj.slice(0, 12) + first);
  return cnpj.endsWith(`${first}${second}`);
}

export const cnpjSchema = z
  .string()
  .transform(normalizeCnpj)
  .refine(isValidCnpj, { message: "CNPJ inválido" });
