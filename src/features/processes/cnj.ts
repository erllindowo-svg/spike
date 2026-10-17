// Numeração única do CNJ (Resolução 65/2008): NNNNNNN-DD.AAAA.J.TR.OOOO.
const CNJ_DIGITS = 20;

export function normalizeCnj(value: string): string {
  return value.replace(/\D/g, "");
}

export function formatCnj(value: string): string {
  const digits = normalizeCnj(value);
  return digits.replace(
    /^(\d{7})(\d{2})(\d{4})(\d)(\d{2})(\d{4})$/,
    "$1-$2.$3.$4.$5.$6",
  );
}

// Dígitos verificadores calculados por módulo 97 (ISO 7064) sobre
// NNNNNNN + AAAA + J + TR + OOOO.
export function computeCnjCheckDigits(
  sequential: string,
  rest: string,
): string {
  const remainder = BigInt(`${sequential}${rest}00`) % BigInt(97);
  return (BigInt(98) - remainder).toString().padStart(2, "0");
}

export function isValidCnj(value: string): boolean {
  const digits = normalizeCnj(value);
  if (digits.length !== CNJ_DIGITS) return false;

  return (
    digits.slice(7, 9) ===
    computeCnjCheckDigits(digits.slice(0, 7), digits.slice(9))
  );
}
