import { beforeEach, describe, expect, it, vi } from "vitest";

import type { JuditRequest } from "@/db/models";
import { getCompanyByCnpj } from "@/features/companies/db";
import { processEventsForReference } from "@/features/webhooks/process";
import {
  applicationErrorItem,
  createdRequestBody,
  responsesBody,
} from "@/lib/judit/__fixtures__/requests";
import { fakeWebhookToken } from "@/lib/judit/__fixtures__/webhooks";

import { checkAsyncQueryAction, startAsyncQueryAction } from "./actions";
import {
  findOpenJuditRequest,
  getJuditRequest,
  saveJuditRequest,
  updateJuditRequestStatus,
} from "./db";

// The actions run with the real JUDIT client (guard, schemas, errors) and a
// mocked fetch. The database functions are covered in db.test.ts, and
// refresh() only works inside a real Next.js request.
vi.mock("@/features/companies/db", () => ({ getCompanyByCnpj: vi.fn() }));
vi.mock("./db", () => ({
  findOpenJuditRequest: vi.fn(),
  getJuditRequest: vi.fn(),
  saveJuditRequest: vi.fn(),
  updateJuditRequestStatus: vi.fn(),
}));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
// The processing rules are tested in src/features/webhooks/process.test.ts.
vi.mock("@/features/webhooks/process", () => ({
  processEventsForReference: vi.fn(),
}));

const TEST_CNPJ = "A1B2C3D4E5F668";
const REQUEST_ID = createdRequestBody.request_id;
const company = {
  id: "company-1",
  cnpj: TEST_CNPJ,
  legalName: null,
  registrationStatus: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};
const storedRequest: JuditRequest = {
  id: "row-1",
  requestId: REQUEST_ID,
  companyId: company.id,
  mode: "historical_async",
  delivery: "polling",
  searchType: "cnpj",
  searchKey: TEST_CNPJ,
  cacheTtlInDays: null,
  status: "pending",
  createdAt: new Date(),
  updatedAt: new Date(),
  lastCheckedAt: null,
};

// Answers each fetch with the next body in the list.
function mockFetch(...bodies: unknown[]) {
  const queue = [...bodies];
  const fetchMock = vi.fn(
    async () =>
      new Response(JSON.stringify(queue.shift()), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function sentBody(fetchMock: ReturnType<typeof mockFetch>, call = 0) {
  const init = fetchMock.mock.calls[call] as unknown as [URL, RequestInit];
  return JSON.parse(String(init[1].body));
}

function sentUrl(fetchMock: ReturnType<typeof mockFetch>, call: number) {
  return String((fetchMock.mock.calls[call] as unknown as [URL])[0]);
}

beforeEach(() => {
  vi.stubEnv("DATA_SOURCE", "db");
  vi.stubEnv("JUDIT_LIVE_CALLS", "enabled");
  vi.stubEnv("JUDIT_API_KEY", "test-key");
  vi.stubEnv("JUDIT_WEBHOOK_PUBLIC_ORIGIN", "");
  vi.stubEnv("JUDIT_WEBHOOK_TOKEN", "");
  vi.mocked(processEventsForReference).mockReset().mockResolvedValue([]);
  vi.mocked(getCompanyByCnpj).mockReset().mockResolvedValue(company);
  vi.mocked(getJuditRequest).mockReset().mockResolvedValue(storedRequest);
  vi.mocked(findOpenJuditRequest).mockReset().mockResolvedValue(null);
  vi.mocked(saveJuditRequest)
    .mockReset()
    .mockImplementation(async (input) => ({ ...storedRequest, ...input }));
  vi.mocked(updateJuditRequestStatus)
    .mockReset()
    .mockImplementation(async (_id, status) => ({ ...storedRequest, status }));
});

describe("startAsyncQueryAction", () => {
  it("refuses in demo mode, even when called directly", async () => {
    vi.stubEnv("DATA_SOURCE", "demo");
    mockFetch();

    expect(
      await startAsyncQueryAction({
        mode: "historical_async",
        cnpj: TEST_CNPJ,
      }),
    ).toMatchObject({ ok: false, reason: "unavailable" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("historical_async sends neither on_demand nor cache_ttl_in_days", async () => {
    const fetchMock = mockFetch(createdRequestBody);

    const result = await startAsyncQueryAction({
      mode: "historical_async",
      cnpj: "A1B2C3D4/E5F6-68",
    });

    expect(sentBody(fetchMock)).toEqual({
      search: { search_type: "cnpj", search_key: TEST_CNPJ },
    });
    expect(saveJuditRequest).toHaveBeenCalledWith({
      requestId: REQUEST_ID,
      companyId: company.id,
      mode: "historical_async",
      delivery: "polling",
      searchType: "cnpj",
      searchKey: TEST_CNPJ,
      cacheTtlInDays: null,
      status: "pending",
    });
    expect(result).toMatchObject({ ok: true });
  });

  it("refuses a second query while the same one is still open, without calling JUDIT", async () => {
    vi.mocked(findOpenJuditRequest).mockResolvedValue(storedRequest);
    mockFetch(createdRequestBody);

    const result = await startAsyncQueryAction({
      mode: "historical_async",
      cnpj: TEST_CNPJ,
    });

    expect(result).toMatchObject({ ok: false, reason: "invalid" });
    expect(findOpenJuditRequest).toHaveBeenCalledWith(
      company.id,
      "historical_async",
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("asks for webhook delivery when a public origin is configured", async () => {
    vi.stubEnv(
      "JUDIT_WEBHOOK_PUBLIC_ORIGIN",
      "https://exemplo.trycloudflare.com",
    );
    vi.stubEnv("JUDIT_WEBHOOK_TOKEN", fakeWebhookToken);
    const fetchMock = mockFetch(createdRequestBody);

    const result = await startAsyncQueryAction({
      mode: "historical_async",
      cnpj: TEST_CNPJ,
    });

    expect(result).toMatchObject({ ok: true });
    expect(sentBody(fetchMock).callback_url).toBe(
      `https://exemplo.trycloudflare.com/api/webhooks/judit?token=${fakeWebhookToken}`,
    );
    expect(saveJuditRequest).toHaveBeenCalledWith(
      expect.objectContaining({ delivery: "webhook" }),
    );
    // Deliveries that arrived before the insert are processed now.
    expect(processEventsForReference).toHaveBeenCalledWith(REQUEST_ID);
  });

  it("stays on polling without a public origin", async () => {
    vi.stubEnv("JUDIT_WEBHOOK_TOKEN", fakeWebhookToken);
    const fetchMock = mockFetch(createdRequestBody);

    await startAsyncQueryAction({ mode: "historical_async", cnpj: TEST_CNPJ });

    expect(sentBody(fetchMock)).not.toHaveProperty("callback_url");
    expect(saveJuditRequest).toHaveBeenCalledWith(
      expect.objectContaining({ delivery: "polling" }),
    );
    expect(processEventsForReference).not.toHaveBeenCalled();
  });

  it("refuses a half-configured webhook (origin without token) before calling JUDIT", async () => {
    vi.stubEnv(
      "JUDIT_WEBHOOK_PUBLIC_ORIGIN",
      "https://exemplo.trycloudflare.com",
    );
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockFetch(createdRequestBody);

    const result = await startAsyncQueryAction({
      mode: "historical_async",
      cnpj: TEST_CNPJ,
    });

    expect(result).toMatchObject({ ok: false, reason: "error" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("historical_on_demand sends on_demand and the optional cache TTL", async () => {
    const fetchMock = mockFetch(createdRequestBody);

    await startAsyncQueryAction({
      mode: "historical_on_demand",
      cnpj: TEST_CNPJ,
      cacheTtlInDays: 7,
    });

    expect(sentBody(fetchMock).search).toEqual({
      search_type: "cnpj",
      search_key: TEST_CNPJ,
      on_demand: true,
      cache_ttl_in_days: 7,
    });
    expect(saveJuditRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "historical_on_demand",
        cacheTtlInDays: 7,
      }),
    );
  });

  it("rejects a non-positive cache TTL before calling JUDIT", async () => {
    mockFetch();

    expect(
      await startAsyncQueryAction({
        mode: "historical_on_demand",
        cnpj: TEST_CNPJ,
        cacheTtlInDays: 0,
      }),
    ).toMatchObject({ ok: false, reason: "invalid" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not call JUDIT for a CNPJ outside the allowlist", async () => {
    const other = "11222333000181";
    vi.mocked(getCompanyByCnpj).mockResolvedValue({ ...company, cnpj: other });
    mockFetch();

    expect(
      await startAsyncQueryAction({ mode: "historical_async", cnpj: other }),
    ).toMatchObject({ ok: false, reason: "not_allowed" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("logs the request_id when saving fails after JUDIT accepted", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockFetch(createdRequestBody);
    vi.mocked(saveJuditRequest).mockRejectedValue(new Error("db down"));

    const result = await startAsyncQueryAction({
      mode: "historical_async",
      cnpj: TEST_CNPJ,
    });

    expect(result).toMatchObject({ ok: false, reason: "error" });
    expect(info).toHaveBeenCalledWith(expect.stringContaining(REQUEST_ID));
  });
});

describe("checkAsyncQueryAction", () => {
  it("only follows requests created by this app", async () => {
    vi.mocked(getJuditRequest).mockResolvedValue(null);
    mockFetch();

    expect(await checkAsyncQueryAction("someone-elses-id")).toMatchObject({
      ok: false,
      reason: "invalid",
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("stores the new status and does not read responses before completed", async () => {
    const fetchMock = mockFetch({ ...createdRequestBody, status: "started" });

    const result = await checkAsyncQueryAction(REQUEST_ID);

    expect(updateJuditRequestStatus).toHaveBeenCalledWith(
      REQUEST_ID,
      "started",
    );
    expect(result).toMatchObject({
      ok: true,
      request: { status: "started" },
      results: null,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not ask JUDIT for the status of a request already completed", async () => {
    vi.mocked(getJuditRequest).mockResolvedValue({
      ...storedRequest,
      status: "completed",
    });
    const fetchMock = mockFetch(responsesBody);

    const result = await checkAsyncQueryAction(REQUEST_ID);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sentUrl(fetchMock, 0)).toContain("/responses");
    expect(updateJuditRequestStatus).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      ok: true,
      request: { status: "completed" },
    });
  });

  it("reads and maps the responses once completed", async () => {
    const fetchMock = mockFetch(
      { ...createdRequestBody, status: "completed" },
      {
        ...responsesBody,
        all_count: 3,
        page_count: 3,
        page_data: [
          responsesBody.page_data[0],
          { ...applicationErrorItem, tags: { cached_response: true } },
          { response_id: "x", response_type: "entity", response_data: {} },
        ],
      },
    );

    const result = await checkAsyncQueryAction(REQUEST_ID);

    expect(sentUrl(fetchMock, 1)).toContain(`request_id=${REQUEST_ID}`);
    expect(result).toMatchObject({
      ok: true,
      results: {
        totalResponses: 3,
        loadedResponses: 3,
        cachedResponses: 1,
        ignoredResponses: 1,
        applicationErrors: [
          "LAWSUIT_NOT_FOUND: Lawsuit 0000000-00.0000.0.00.0000 not found in datalake or court.",
        ],
        lawsuits: [{ cnj: "99999999999999999999", companyId: company.id }],
      },
    });
  });
});
