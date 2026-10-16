import { beforeEach, describe, expect, it, vi } from "vitest";

import { saveSyncQuery } from "@/features/queries/db";
import { entityCnpjBody } from "@/lib/judit/__fixtures__/lawsuits";

import { addCompanyAction, refreshRegistrationDataAction } from "./actions";
import {
  ensureCompany,
  getCompanyByCnpj,
  updateCompanyRegistration,
} from "./db";

// The actions run with the real JUDIT client (guard, schema, errors) and a
// mocked fetch. The database functions are replaced; refresh() only works
// inside a real Next.js request.
// The daily cap reads the database; covered in src/features/queries/budget.test.ts.
vi.mock("@/features/queries/budget", () => ({ assertDailyBudget: vi.fn() }));
vi.mock("./db", () => ({
  ensureCompany: vi.fn(),
  getCompanyByCnpj: vi.fn(),
  updateCompanyRegistration: vi.fn(),
}));
vi.mock("@/features/queries/db", () => ({ saveSyncQuery: vi.fn() }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));

const TEST_CNPJ = "A1B2C3D4E5F668";
const company = {
  id: "company-1",
  cnpj: TEST_CNPJ,
  legalName: null,
  registrationStatus: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// The docs example answers for another CNPJ; here it stands for the test
// company, so main_document is replaced.
const entityBody = {
  ...entityCnpjBody,
  response_data: [
    { ...entityCnpjBody.response_data[0], main_document: "A1B2C3D4/E5F6-68" },
  ],
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
  vi.mocked(ensureCompany).mockReset().mockResolvedValue(company);
  vi.mocked(getCompanyByCnpj).mockReset().mockResolvedValue(company);
  vi.mocked(updateCompanyRegistration).mockReset();
  vi.mocked(saveSyncQuery).mockReset();
});

describe("addCompanyAction", () => {
  it("refuses in demo mode, even when called directly", async () => {
    vi.stubEnv("DATA_SOURCE", "demo");

    expect(
      await addCompanyAction({ cnpj: TEST_CNPJ, lookup: true }),
    ).toMatchObject({ ok: false, reason: "unavailable" });
    expect(ensureCompany).not.toHaveBeenCalled();
  });

  it("saves without calling JUDIT when no lookup is asked", async () => {
    expect(
      await addCompanyAction({ cnpj: "A1B2C3D4/E5F6-68", lookup: false }),
    ).toEqual({ ok: true, cnpj: TEST_CNPJ, registration: null });
    expect(fetch).not.toHaveBeenCalled();
    expect(ensureCompany).toHaveBeenCalledWith(TEST_CNPJ);
  });

  it("looks up the registration data, saves it and records the query", async () => {
    const fetchMock = mockFetch(entityBody);

    const result = await addCompanyAction({ cnpj: TEST_CNPJ, lookup: true });

    expect(result).toMatchObject({
      ok: true,
      registration: {
        found: true,
        legalName: "FINGI - EM RECUPERACAO JUDICIAL",
      },
    });
    const init = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    expect(String(init[0])).toContain("/entities");
    expect(updateCompanyRegistration).toHaveBeenCalledWith("company-1", {
      found: true,
      legalName: "FINGI - EM RECUPERACAO JUDICIAL",
      registrationStatus: "Ativa",
    });
    expect(saveSyncQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "registration_data",
        outcome: "ok",
        resultCount: 1,
      }),
    );
  });

  it("saves nothing when the allowlist blocks the lookup", async () => {
    // Valid check digits, but not allowlisted.
    expect(
      await addCompanyAction({ cnpj: "11222333000181", lookup: true }),
    ).toMatchObject({ ok: false, reason: "not_allowed" });
    expect(fetch).not.toHaveBeenCalled();
    expect(ensureCompany).not.toHaveBeenCalled();
    expect(saveSyncQuery).not.toHaveBeenCalled();
  });

  it("saves the company even when JUDIT has no registration data", async () => {
    mockFetch({ request_id: "r-1", response_data: [] });

    expect(
      await addCompanyAction({ cnpj: TEST_CNPJ, lookup: true }),
    ).toMatchObject({ ok: true, registration: { found: false } });
    expect(ensureCompany).toHaveBeenCalled();
    expect(updateCompanyRegistration).not.toHaveBeenCalled();
  });
});

describe("refreshRegistrationDataAction", () => {
  it("only refreshes companies saved in the app", async () => {
    vi.mocked(getCompanyByCnpj).mockResolvedValue(null);

    expect(await refreshRegistrationDataAction(TEST_CNPJ)).toMatchObject({
      ok: false,
      reason: "invalid",
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("records a JUDIT error in the history and reports it", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockFetch({ error: { name: "INTERNAL", message: "boom" } }, 500);

    expect(await refreshRegistrationDataAction(TEST_CNPJ)).toMatchObject({
      ok: false,
      reason: "error",
    });
    expect(saveSyncQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "registration_data",
        companyId: "company-1",
        outcome: "failed",
        errorKind: "http",
      }),
    );
    expect(updateCompanyRegistration).not.toHaveBeenCalled();
  });
});
