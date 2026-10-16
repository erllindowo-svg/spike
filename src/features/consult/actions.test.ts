import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Party } from "@/db/models";
import { ensureParty, updatePartyRegistration } from "@/features/parties/db";
import { startAsyncQueryAction } from "@/features/queries/actions";
import { saveSyncQuery } from "@/features/queries/db";
import { getDataSource, getPartyByDocument, listLawsuits } from "@/lib/data";
import {
  entityCnpjBody,
  syntheticBody,
} from "@/lib/judit/__fixtures__/lawsuits";

import { runConsultAction } from "./actions";

// The action runs with the real JUDIT client (guard, schemas, errors) and a
// mocked fetch. The data layer, the history record and the async flow are
// replaced; they have their own tests.
vi.mock("@/lib/data", () => ({
  getDataSource: vi.fn(),
  getPartyByDocument: vi.fn(),
  getLawsuitByCnj: vi.fn(),
  listLawsuits: vi.fn(),
}));
vi.mock("@/features/parties/db", () => ({
  ensureParty: vi.fn(),
  updatePartyRegistration: vi.fn(),
}));
vi.mock("@/features/queries/db", () => ({ saveSyncQuery: vi.fn() }));
vi.mock("@/features/queries/budget", () => ({ assertDailyBudget: vi.fn() }));
vi.mock("@/features/queries/actions", () => ({
  startAsyncQueryAction: vi.fn(),
}));

const TEST_CNPJ = "A1B2C3D4E5F668";
const TEST_CNJ = "00000003920268260050";
const party: Party = {
  id: "party-1",
  documentType: "cnpj",
  document: TEST_CNPJ,
  name: null,
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
  vi.stubEnv("JUDIT_LIVE_CALLS", "enabled");
  vi.mocked(getDataSource).mockReturnValue("db");
  vi.mocked(getPartyByDocument).mockReset().mockResolvedValue(party);
  vi.mocked(saveSyncQuery).mockReset();
  vi.mocked(updatePartyRegistration).mockReset();
  vi.mocked(ensureParty).mockReset().mockResolvedValue(party);
  vi.mocked(startAsyncQueryAction).mockReset();
});

describe("runConsultAction", () => {
  it("refuses a feature that does not accept the identifier type", async () => {
    expect(
      await runConsultAction({
        feature: "registration",
        searchType: "cnj",
        searchKey: TEST_CNJ,
      }),
    ).toMatchObject({ ok: false, reason: "invalid" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("counts lawsuits and records only the total", async () => {
    mockFetch({ total: 12 });

    const result = await runConsultAction({
      feature: "count",
      searchType: "cnpj",
      searchKey: "A1B2C3D4/E5F6-68",
    });

    expect(result).toEqual({
      ok: true,
      demo: false,
      payload: { kind: "count", total: 12 },
    });
    expect(saveSyncQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "datalake_count",
        partyId: "party-1",
        searchType: "cnpj",
        searchKey: TEST_CNPJ,
        outcome: "ok",
        resultCount: 12,
      }),
    );
  });

  it("groups the synthetic counts for the charts", async () => {
    mockFetch(syntheticBody);

    const result = await runConsultAction({
      feature: "synthetic",
      searchType: "cnpj",
      searchKey: TEST_CNPJ,
    });

    expect(result).toMatchObject({ ok: true, payload: { kind: "synthetic" } });
    if (!result.ok || result.payload.kind !== "synthetic") return;
    expect(result.payload.groups.map((g) => g.title)).toContain("Tribunal");
  });

  it("treats a lawsuit missing from the datalake (404) as a result", async () => {
    mockFetch(
      { error: { name: "HttpNotFoundError", message: "NOT_FOUND" } },
      404,
    );

    const result = await runConsultAction({
      feature: "lawsuit_datalake",
      searchType: "cnj",
      searchKey: "0000000-39.2026.8.26.0050",
    });

    expect(result).toEqual({
      ok: true,
      demo: false,
      payload: { kind: "lawsuit", lawsuits: [] },
    });
    expect(saveSyncQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "lawsuit_datalake",
        partyId: null,
        searchType: "cnj",
        resultCount: 0,
      }),
    );
  });

  it("refreshes a saved party with the registration data", async () => {
    mockFetch({
      ...entityCnpjBody,
      response_data: [
        { ...entityCnpjBody.response_data[0], main_document: TEST_CNPJ },
      ],
    });

    const result = await runConsultAction({
      feature: "registration",
      searchType: "cnpj",
      searchKey: TEST_CNPJ,
    });

    expect(result).toMatchObject({
      ok: true,
      payload: {
        kind: "registration",
        registration: { found: true, tradeName: "FING" },
      },
    });
    expect(updatePartyRegistration).toHaveBeenCalledWith(
      "party-1",
      expect.objectContaining({ name: "FINGI - EM RECUPERACAO JUDICIAL" }),
    );
  });

  it("asks the Receita in real time for the on-demand registration data", async () => {
    const fetchMock = mockFetch({ response_data: [] });

    const result = await runConsultAction({
      feature: "registration_on_demand",
      searchType: "cnpj",
      searchKey: TEST_CNPJ,
    });

    expect(result).toMatchObject({
      ok: true,
      payload: { kind: "registration", registration: { found: false } },
    });
    const init = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    expect(JSON.parse(String(init[1].body)).search).toMatchObject({
      on_demand: true,
    });
    expect(saveSyncQuery).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "registration_on_demand" }),
    );
  });

  it("saves the party before an async history query", async () => {
    vi.mocked(startAsyncQueryAction).mockResolvedValue({
      ok: true,
      request: { requestId: "r-1" } as never,
    });

    const result = await runConsultAction({
      feature: "history_async",
      searchType: "cnpj",
      searchKey: TEST_CNPJ,
    });

    expect(ensureParty).toHaveBeenCalledWith("cnpj", TEST_CNPJ);
    expect(startAsyncQueryAction).toHaveBeenCalledWith({
      mode: "historical_async",
      documentType: "cnpj",
      document: TEST_CNPJ,
    });
    expect(result).toMatchObject({
      ok: true,
      payload: { kind: "async", requestId: "r-1" },
    });
  });

  it("creates the warrants query for a person, saving the person first", async () => {
    vi.mocked(startAsyncQueryAction).mockResolvedValue({
      ok: true,
      request: { requestId: "r-2" } as never,
    });

    const result = await runConsultAction({
      feature: "warrants",
      searchType: "cpf",
      searchKey: "000.000.001-91",
    });

    expect(ensureParty).toHaveBeenCalledWith("cpf", "00000000191");
    expect(startAsyncQueryAction).toHaveBeenCalledWith({
      mode: "warrant",
      documentType: "cpf",
      document: "00000000191",
    });
    expect(result).toMatchObject({ ok: true, payload: { kind: "async" } });
  });

  it("creates the full lawsuit query by CNJ with the AI summary option", async () => {
    vi.mocked(startAsyncQueryAction).mockResolvedValue({
      ok: true,
      request: { requestId: "r-3" } as never,
    });

    await runConsultAction({
      feature: "lawsuit_async",
      searchType: "cnj",
      searchKey: "0000000-39.2026.8.26.0050",
      aiSummary: true,
    });

    expect(ensureParty).not.toHaveBeenCalled();
    expect(startAsyncQueryAction).toHaveBeenCalledWith({
      mode: "lawsuit_async",
      cnj: TEST_CNJ,
      aiSummary: true,
    });
  });

  it("keeps a CPF out of JUDIT in restricted mode", async () => {
    const result = await runConsultAction({
      feature: "count",
      searchType: "cpf",
      searchKey: "000.000.001-91",
    });

    expect(result).toMatchObject({ ok: false, reason: "not_allowed" });
    expect(fetch).not.toHaveBeenCalled();
    expect(saveSyncQuery).not.toHaveBeenCalled();
  });

  it("answers from the fictitious data in demo mode, without JUDIT", async () => {
    vi.mocked(getDataSource).mockReturnValue("demo");
    vi.mocked(listLawsuits).mockResolvedValue([]);

    const result = await runConsultAction({
      feature: "count",
      searchType: "cnpj",
      searchKey: TEST_CNPJ,
    });

    expect(result).toEqual({
      ok: true,
      demo: true,
      payload: { kind: "count", total: 0 },
    });
    expect(fetch).not.toHaveBeenCalled();
  });
});
