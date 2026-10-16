import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCompanyByCnpj } from "@/features/companies/db";
import { assertDailyBudget } from "@/features/queries/budget";
import { saveSyncQuery } from "@/features/queries/db";
import { JuditDailyBudgetError } from "@/lib/judit/errors";
import { hotStorageObservedBody } from "@/lib/judit/__fixtures__/lawsuits";

import { searchCompanyLawsuitsAction } from "./actions";

// The action runs with the real JUDIT client (guard, schema, errors) and a
// mocked fetch; only the database lookup is replaced.
// The daily cap reads the database; covered in src/features/queries/budget.test.ts.
vi.mock("@/features/queries/budget", () => ({ assertDailyBudget: vi.fn() }));
vi.mock("@/features/companies/db", () => ({ getCompanyByCnpj: vi.fn() }));
// The history record (page Consultas) is only observed.
vi.mock("@/features/queries/db", () => ({ saveSyncQuery: vi.fn() }));

const TEST_CNPJ = "A1B2C3D4E5F668";
const company = {
  id: "company-1",
  cnpj: TEST_CNPJ,
  legalName: null,
  registrationStatus: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function mockFetch(body: unknown, status = 200) {
  const fetchMock = vi.fn(
    async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.stubEnv("DATA_SOURCE", "db");
  vi.stubEnv("JUDIT_LIVE_CALLS", "enabled");
  vi.mocked(getCompanyByCnpj).mockReset().mockResolvedValue(company);
  vi.mocked(saveSyncQuery).mockReset();
});

describe("searchCompanyLawsuitsAction", () => {
  it("refuses in demo mode, even when called directly", async () => {
    vi.stubEnv("DATA_SOURCE", "demo");

    expect(await searchCompanyLawsuitsAction(TEST_CNPJ)).toMatchObject({
      ok: false,
      reason: "unavailable",
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects an invalid CNPJ before any lookup", async () => {
    expect(await searchCompanyLawsuitsAction("123")).toMatchObject({
      reason: "invalid",
    });
    expect(getCompanyByCnpj).not.toHaveBeenCalled();
  });

  it("only searches companies registered in the app", async () => {
    vi.mocked(getCompanyByCnpj).mockResolvedValue(null);

    expect(await searchCompanyLawsuitsAction(TEST_CNPJ)).toMatchObject({
      reason: "invalid",
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not call JUDIT when the kill switch is off", async () => {
    vi.stubEnv("JUDIT_LIVE_CALLS", "");

    expect(await searchCompanyLawsuitsAction(TEST_CNPJ)).toMatchObject({
      reason: "live_calls_disabled",
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not call JUDIT for a CNPJ outside the allowlist", async () => {
    // Valid check digits, but not allowlisted.
    const other = "11222333000181";
    vi.mocked(getCompanyByCnpj).mockResolvedValue({ ...company, cnpj: other });

    expect(await searchCompanyLawsuitsAction(other)).toMatchObject({
      reason: "not_allowed",
    });
    expect(fetch).not.toHaveBeenCalled();
    // Blocked before leaving the server: nothing to record.
    expect(saveSyncQuery).not.toHaveBeenCalled();
  });

  it("returns the mapped lawsuits and the JUDIT request_id", async () => {
    const fetchMock = mockFetch(hotStorageObservedBody);

    const result = await searchCompanyLawsuitsAction("A1B2C3D4/E5F6-68");

    expect(result).toMatchObject({
      ok: true,
      requestId: "2bf22fa7-4061-4ea6-8e69-b479bc12c24c",
      lawsuits: [
        {
          cnj: "00000003920268260050",
          companyId: "company-1",
          companyRole: "passive",
        },
      ],
    });
    const init = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    expect(JSON.parse(String(init[1].body)).search).toMatchObject({
      search_type: "cnpj",
      search_key: TEST_CNPJ,
    });
    // Metadata only: the count, never the lawsuits.
    expect(saveSyncQuery).toHaveBeenCalledWith({
      mode: "datalake_sync",
      companyId: "company-1",
      searchType: "cnpj",
      searchKey: TEST_CNPJ,
      requestId: "2bf22fa7-4061-4ea6-8e69-b479bc12c24c",
      outcome: "ok",
      resultCount: 1,
      errorKind: null,
    });
  });

  it("still returns the lawsuits when the history record fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(saveSyncQuery).mockRejectedValue(new Error("db down"));
    mockFetch(hotStorageObservedBody);

    expect(await searchCompanyLawsuitsAction(TEST_CNPJ)).toMatchObject({
      ok: true,
    });
  });

  it("reports a JUDIT HTTP error without leaking the body", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockFetch({ error: { name: "INTERNAL", message: "boom" } }, 500);

    const result = await searchCompanyLawsuitsAction(TEST_CNPJ);

    expect(result).toEqual({
      ok: false,
      reason: "error",
      message: "A JUDIT retornou um erro (http). Detalhes no log do servidor.",
    });
    expect(saveSyncQuery).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "failed", errorKind: "http" }),
    );
  });

  it("stops at the daily cap before calling JUDIT, and records nothing", async () => {
    vi.mocked(assertDailyBudget).mockRejectedValueOnce(
      new JuditDailyBudgetError(50, 50),
    );

    const result = await searchCompanyLawsuitsAction(TEST_CNPJ);

    expect(result).toMatchObject({ ok: false, reason: "cost_guard" });
    expect(result.ok === false && result.message).toContain("Teto diário");
    expect(fetch).not.toHaveBeenCalled();
    expect(saveSyncQuery).not.toHaveBeenCalled();
  });

  it("shows at most 500 lawsuits and tells the total", async () => {
    const many = Array.from({ length: 501 }, (_, i) => ({
      ...hotStorageObservedBody.lawsuits[0],
      code: `00000${String(i).padStart(2, "0")}39.2026.8.26.0050`.slice(-20),
      instance: i + 1,
    }));
    mockFetch({ ...hotStorageObservedBody, lawsuits: many });

    const result = await searchCompanyLawsuitsAction(TEST_CNPJ);

    expect(result).toMatchObject({ ok: true, total: 501 });
    expect(result.ok && result.lawsuits).toHaveLength(500);
  });
});
