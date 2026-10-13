import { describe, expect, it } from "vitest";

import { isUniqueViolation } from "./errors";

const NAME = "trackings_active_search_key_unique";

describe("isUniqueViolation", () => {
  it("recognizes a postgres.js error wrapped by Drizzle", () => {
    const wrapped = new Error("Failed query", {
      cause: { code: "23505", constraint_name: NAME },
    });
    expect(isUniqueViolation(wrapped, NAME)).toBe(true);
  });

  it("recognizes a PGlite error used directly", () => {
    expect(isUniqueViolation({ code: "23505", constraint: NAME }, NAME)).toBe(
      true,
    );
  });

  it("ignores a violation of another unique constraint", () => {
    const other = { code: "23505", constraint_name: "companies_cnpj_unique" };
    expect(isUniqueViolation(other, NAME)).toBe(false);
  });

  it("ignores other database errors", () => {
    // 23503: foreign key violation.
    expect(isUniqueViolation({ code: "23503", constraint: NAME }, NAME)).toBe(
      false,
    );
    expect(isUniqueViolation(new Error("connection refused"), NAME)).toBe(
      false,
    );
    expect(isUniqueViolation(undefined, NAME)).toBe(false);
  });
});
