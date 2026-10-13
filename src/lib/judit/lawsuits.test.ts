import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  countBody,
  entityCnpjBody,
  hotStorageBody,
  syntheticBody,
} from "./__fixtures__/lawsuits";
import { JuditGuardError, JuditHttpError } from "./errors";
import {
  countLawsuits,
  getEntity,
  getLawsuitByCnj,
  getLawsuitsSynthetic,
  searchLawsuits,
} from "./lawsuits";

const TEST_CNPJ = "A1B2C3D4/E5F6-68";

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

function sentRequest(fetchMock: ReturnType<typeof mockFetch>) {
  const [url, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
  return {
    url: url.toString(),
    method: init.method,
    body: init.body ? JSON.parse(String(init.body)) : undefined,
  };
}

beforeEach(() => {
  vi.stubEnv("JUDIT_LIVE_CALLS", "enabled");
});

describe("allowlist", () => {
  it("rejects a CNPJ outside the allowlist before fetch runs", async () => {
    const fetchMock = mockFetch(countBody);

    await expect(
      countLawsuits({ searchType: "cnpj", searchKey: "99.999.999/9999-99" }),
    ).rejects.toBeInstanceOf(JuditGuardError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a CNJ outside the allowlist before fetch runs", async () => {
    const fetchMock = mockFetch({});

    await expect(
      getLawsuitByCnj({ cnj: "9999999-99.9999.9.99.9999" }),
    ).rejects.toBeInstanceOf(JuditGuardError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("getEntity", () => {
  it("sends the documented body without on_demand or unmasked partners", async () => {
    const fetchMock = mockFetch(entityCnpjBody);

    const result = await getEntity({
      searchType: "cnpj",
      searchKey: TEST_CNPJ,
    });

    expect(sentRequest(fetchMock)).toEqual({
      url: "https://lawsuits.production.judit.io/entities",
      method: "POST",
      body: {
        search: {
          search_type: "cnpj",
          search_key: TEST_CNPJ,
          response_type: "entity",
        },
      },
    });
    expect(result.response_data[0]).toMatchObject({
      entity_type: "company",
      head_office: true,
    });
  });

  it("sends on_demand only when explicitly requested", async () => {
    const fetchMock = mockFetch(entityCnpjBody);

    await getEntity({
      searchType: "cnpj",
      searchKey: TEST_CNPJ,
      onDemand: true,
    });

    expect(sentRequest(fetchMock).body.search.on_demand).toBe(true);
  });
});

describe("searchLawsuits", () => {
  it("sends no on_demand by default and reads `response_data`", async () => {
    const fetchMock = mockFetch(hotStorageBody);

    const result = await searchLawsuits({
      searchType: "cnpj",
      searchKey: TEST_CNPJ,
    });

    expect(sentRequest(fetchMock).body).toEqual({
      search: { search_type: "cnpj", search_key: TEST_CNPJ },
    });
    expect(result.has_lawsuits).toBe(true);
    expect(result.lawsuits).toHaveLength(1);
    expect(result.lawsuits[0]).toMatchObject({
      code: "9999999-99.9999.9.99.9999",
      tribunal_acronym: "TRT1",
    });
  });

  it("also reads the list from `lawsuits` (OpenAPI shape)", async () => {
    mockFetch({
      has_lawsuits: true,
      request_id: "c37cacba-41b5-4694-919f-4a937f2ea5df",
      lawsuits: hotStorageBody.response_data,
    });

    const result = await searchLawsuits({
      searchType: "cnpj",
      searchKey: TEST_CNPJ,
    });

    expect(result.lawsuits).toHaveLength(1);
  });

  it("treats the documented 404 with has_lawsuits: false as an empty result", async () => {
    mockFetch(
      {
        has_lawsuits: false,
        request_id: "c37cacba-41b5-4694-919f-4a937f2ea5df",
      },
      404,
    );

    const result = await searchLawsuits({
      searchType: "cnpj",
      searchKey: TEST_CNPJ,
    });

    expect(result).toMatchObject({ has_lawsuits: false, lawsuits: [] });
  });

  it("keeps a 404 with an error body as an HTTP error", async () => {
    mockFetch(
      { error: { name: "HttpNotFoundError", message: "NOT_FOUND" } },
      404,
    );

    await expect(
      searchLawsuits({ searchType: "cnpj", searchKey: TEST_CNPJ }),
    ).rejects.toBeInstanceOf(JuditHttpError);
  });

  it("sends filter and inferred parties under search_params", async () => {
    const fetchMock = mockFetch(hotStorageBody);

    await searchLawsuits({
      searchType: "cnpj",
      searchKey: TEST_CNPJ,
      filter: { side: "Passive", amount_gte: 50000 },
      withInferredParties: true,
    });

    expect(sentRequest(fetchMock).body.search.search_params).toEqual({
      filter: { side: "Passive", amount_gte: 50000 },
      with_inferred_parties: true,
    });
  });
});

describe("countLawsuits", () => {
  it("returns the documented total", async () => {
    const fetchMock = mockFetch(countBody);

    await expect(
      countLawsuits({ searchType: "cnpj", searchKey: TEST_CNPJ }),
    ).resolves.toEqual({ total: 12 });
    expect(sentRequest(fetchMock)).toMatchObject({
      url: "https://lawsuits.production.judit.io/lawsuits/count",
      body: { search: { response_type: "lawsuits" } },
    });
  });
});

describe("getLawsuitsSynthetic", () => {
  it("parses the documented buckets", async () => {
    mockFetch(syntheticBody);

    const result = await getLawsuitsSynthetic({
      searchType: "cnpj",
      searchKey: TEST_CNPJ,
    });

    expect(result.lawsuits_count).toBe(27);
    expect(result.tribunals).toEqual([{ count: 8, value: "TRT1" }]);
  });
});
