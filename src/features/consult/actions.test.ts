import { describe, expect, it } from "vitest";

import { runConsultAction } from "./actions";

// O protótipo responde com os dados fictícios de src/lib/mock-data.ts, sem
// rede (o fetch falha em todo teste: vitest.setup.ts).
const AURORA_CNPJ = "10101010000177";
const UNKNOWN_CNPJ = "A1B2C3D4E5F668";
const AURORA_CNJ = "10045122920258260100";

describe("runConsultAction", () => {
  it("refuses a feature that does not accept the identifier type", async () => {
    expect(
      await runConsultAction({
        feature: "registration",
        searchType: "cnj",
        searchKey: AURORA_CNJ,
      }),
    ).toMatchObject({ ok: false, reason: "invalid" });
  });

  it("counts the fictitious lawsuits of a known company", async () => {
    const result = await runConsultAction({
      feature: "count",
      searchType: "cnpj",
      searchKey: AURORA_CNPJ,
    });
    expect(result).toMatchObject({ ok: true, demo: true });
    if (!result.ok) throw new Error("expected a result");
    expect(result.payload).toMatchObject({ kind: "count" });
    expect(
      result.payload.kind === "count" && result.payload.total,
    ).toBeGreaterThan(0);
  });

  it("answers an unknown company with nothing found", async () => {
    expect(
      await runConsultAction({
        feature: "lawsuits",
        searchType: "cnpj",
        searchKey: UNKNOWN_CNPJ,
      }),
    ).toEqual({
      ok: true,
      demo: true,
      payload: { kind: "lawsuits", lawsuits: [], total: 0 },
    });
  });

  it("finds a fictitious lawsuit by CNJ", async () => {
    const result = await runConsultAction({
      feature: "lawsuit_datalake",
      searchType: "cnj",
      searchKey: AURORA_CNJ,
    });
    expect(result).toMatchObject({
      ok: true,
      payload: { kind: "lawsuit", lawsuits: [{ cnj: AURORA_CNJ }] },
    });
  });

  it("has no async queries", async () => {
    expect(
      await runConsultAction({
        feature: "history_async",
        searchType: "cnpj",
        searchKey: AURORA_CNPJ,
      }),
    ).toMatchObject({ ok: false, reason: "unavailable" });
  });

  it("has no search by name", async () => {
    expect(
      await runConsultAction({
        feature: "count",
        searchType: "name",
        searchKey: "Padaria de Exemplo",
      }),
    ).toMatchObject({ ok: false, reason: "unavailable" });
  });
});
