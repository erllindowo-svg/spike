// Código do PostgreSQL para violação de UNIQUE
// (https://www.postgresql.org/docs/current/errcodes-appendix.html).
const UNIQUE_VIOLATION = "23505";

// Indica se `error` é uma violação de UNIQUE da restrição ou índice informado.
// O Drizzle embrulha o erro do driver em DrizzleQueryError, então o erro do
// PostgreSQL pode ser o próprio erro ou o seu `cause`. O nome da restrição é
// conferido para não confundir com a violação de outra regra de unicidade.
// O postgres.js expõe o nome em `constraint_name`; o PGlite (testes), em
// `constraint`.
export function isUniqueViolation(error: unknown, constraint: string): boolean {
  for (const candidate of [error, (error as { cause?: unknown })?.cause]) {
    if (typeof candidate !== "object" || candidate === null) continue;
    const pgError = candidate as {
      code?: unknown;
      constraint_name?: unknown;
      constraint?: unknown;
    };
    if (
      pgError.code === UNIQUE_VIOLATION &&
      (pgError.constraint_name ?? pgError.constraint) === constraint
    ) {
      return true;
    }
  }
  return false;
}
