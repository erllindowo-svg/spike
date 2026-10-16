import { z } from "zod";

// CPF: 9 dígitos e 2 verificadores (módulo 11). CPF é dado pessoal (LGPD):
// nas listas ele aparece mascarado (maskCpf), completo só na página da
// pessoa (escolha R6 em docs/etapa-7-escopo.md).

export function normalizeCpf(value: string): string {
  return value.replace(/\D/g, "");
}

export function formatCpf(value: string): string {
  return normalizeCpf(value).replace(
    /^(\d{3})(\d{3})(\d{3})(\d{2})$/,
    "$1.$2.$3-$4",
  );
}

// "***.456.789-**": os dígitos do meio bastam para reconhecer a pessoa numa
// lista sem expor o documento inteiro.
export function maskCpf(value: string): string {
  const cpf = normalizeCpf(value);
  if (cpf.length !== 11) return "CPF";
  return `***.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-**`;
}

function checkDigit(digits: string): number {
  const weight = digits.length + 1;
  const sum = [...digits].reduce(
    (acc, digit, index) => acc + Number(digit) * (weight - index),
    0,
  );
  const rest = (sum * 10) % 11;
  return rest === 10 ? 0 : rest;
}

export function isValidCpf(value: string): boolean {
  const cpf = normalizeCpf(value);
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  const first = checkDigit(cpf.slice(0, 9));
  const second = checkDigit(cpf.slice(0, 9) + first);
  return cpf.endsWith(`${first}${second}`);
}

export const cpfSchema = z
  .string()
  .transform(normalizeCpf)
  .refine(isValidCpf, { message: "CPF inválido" });
