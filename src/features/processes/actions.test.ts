import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCompanyByCnpj } from "@/features/companies/db";
import { hotStorageObservedBody } from "@/lib/judit/__fixtures__/lawsuits";

import { searchCompanyLawsuitsAction } from "./actions";

// The action runs with the real JUDIT client (guard, schema, errors) and a
// mocked fetch; only the database lookup is replaced.
vi.mock("@/features/companies/db", () => ({ getCompanyByCnpj: vi.fn() }));

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
  });
});
