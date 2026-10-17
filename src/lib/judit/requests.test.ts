import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  applicationErrorItem,
  completedRequestBody,
  createdRequestBody,
  responsesBody,
} from "./__fixtures__/requests";
import { JuditApplicationError, JuditGuardError } from "./errors";
import {
  createRequest,
  getRequest,
  getResponse,
  listRequests,
  listResponses,
  listTrackingResponses,
} from "./requests";
import { responseCameFromCache } from "./schemas/requests";

const TEST_CNPJ = "A1B2C3D4/E5F6-68";

function mockFetch(body: unknown, status = 200) {
  const fetchMock = vi.fn(async () => Response.json(body, { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function sentRequest(fetchMock: ReturnType<typeof mockFetch>) {
  const [url, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
  return {
    url: new URL(url),
    method: init.method,
    body: init.body ? JSON.parse(String(init.body)) : undefined,
  };
}

beforeEach(() => {
  vi.stubEnv("JUDIT_LIVE_CALLS", "enabled");
});

describe("createRequest", () => {
  it("rejects a key outside the allowlist before fetch runs", async () => {
    const fetchMock = mockFetch(createdRequestBody, 201);

    await expect(
      createRequest({
        searchType: "lawsuit_cnj",
        searchKey: "0009999-99.9999.8.26.9999",
      }),
    ).rejects.toBeInstanceOf(JuditGuardError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends response_type inside search and judit_ia at the top level", async () => {
    const fetchMock = mockFetch(createdRequestBody, 201);

    await createRequest({
      searchType: "cnpj",
      searchKey: TEST_CNPJ,
      responseType: "execution",
      juditIa: ["summary"],
    });

    expect(sentRequest(fetchMock).body).toEqual({
      search: {
        search_type: "cnpj",
        search_key: TEST_CNPJ,
        response_type: "execution",
      },
      judit_ia: ["summary"],
    });
  });

  it("sends no on_demand or with_attachments by default and reads the 201", async () => {
    const fetchMock = mockFetch(createdRequestBody, 201);

    const created = await createRequest({
      searchType: "cnpj",
      searchKey: TEST_CNPJ,
    });

    const sent = sentRequest(fetchMock);
    expect(sent.url.toString()).toBe(
      "https://requests.production.judit.io/requests",
    );
    expect(sent.method).toBe("POST");
    expect(sent.body).toEqual({
      search: { search_type: "cnpj", search_key: TEST_CNPJ },
    });
    expect(created).toMatchObject({
      request_id: "84b4d8f5-50f8-4c14-818f-912c722a6908",
      status: "pending",
    });
  });

  it("sends the costly options only when explicitly requested", async () => {
    const fetchMock = mockFetch(createdRequestBody, 201);

    await createRequest({
      searchType: "cnpj",
      searchKey: TEST_CNPJ,
      onDemand: true,
      withAttachments: true,
      cacheTtlInDays: 7,
    });

    expect(sentRequest(fetchMock).body).toEqual({
      search: {
        search_type: "cnpj",
        search_key: TEST_CNPJ,
        on_demand: true,
        cache_ttl_in_days: 7,
      },
      with_attachments: true,
    });
  });

  it("sends callback_url at the top level of the body, as documented", async () => {
    const fetchMock = mockFetch(createdRequestBody, 201);
    const callbackUrl =
      "https://exemplo.trycloudflare.com/api/webhooks/judit?token=fake";

    await createRequest({
      searchType: "cnpj",
      searchKey: TEST_CNPJ,
      callbackUrl,
    });

    expect(sentRequest(fetchMock).body).toEqual({
      search: { search_type: "cnpj", search_key: TEST_CNPJ },
      callback_url: callbackUrl,
    });
  });
});

describe("getRequest", () => {
  it("reads the documented completed request", async () => {
    const fetchMock = mockFetch(completedRequestBody);

    const request = await getRequest("05ee9825-b2b4-480b-b29e-f071ca7d9c72");

    expect(sentRequest(fetchMock).url.pathname).toBe(
      "/requests/05ee9825-b2b4-480b-b29e-f071ca7d9c72",
    );
    expect(request.status).toBe("completed");
  });

  it("does not break on an undocumented status", async () => {
    mockFetch({ ...completedRequestBody, status: "queued_somewhere_new" });

    await expect(getRequest("abc")).resolves.toMatchObject({
      status: "queued_somewhere_new",
    });
  });
});

describe("listRequests", () => {
  it("sends the created_at range and pagination required by the spec", async () => {
    const fetchMock = mockFetch({
      page: 1,
      page_count: 1,
      all_pages_count: 1,
      all_count: 1,
      page_data: [completedRequestBody],
    });

    const list = await listRequests({
      createdAtGte: "2024-02-01T00:00:00.000Z",
      createdAtLte: "2024-02-29T23:59:59.000Z",
    });

    const params = sentRequest(fetchMock).url.searchParams;
    expect(Object.fromEntries(params)).toEqual({
      created_at_gte: "2024-02-01T00:00:00.000Z",
      created_at_lte: "2024-02-29T23:59:59.000Z",
      page: "1",
      page_size: "10",
    });
    expect(list.page_data).toHaveLength(1);
  });
});

describe("listResponses", () => {
  it("filters by request_id and reads cached info from tags", async () => {
    const fetchMock = mockFetch(responsesBody);

    const list = await listResponses({
      requestId: "03abbf28-822e-45a0-a22c-098fbe157aa4",
    });

    const params = sentRequest(fetchMock).url.searchParams;
    expect(params.get("request_id")).toBe(
      "03abbf28-822e-45a0-a22c-098fbe157aa4",
    );
    expect(params.get("page_size")).toBe("100");
    expect(list.request_status).toBe("completed");
    expect(responseCameFromCache(list.page_data[0])).toBe(false);
  });

  it("keeps an application_error item as a result instead of throwing", async () => {
    mockFetch({ ...responsesBody, page_data: [applicationErrorItem] });

    const list = await listResponses({ requestId: "abc" });

    expect(list.page_data[0].response_type).toBe("application_error");
  });
});

describe("getResponse", () => {
  it("raises JuditApplicationError for an application_error response", async () => {
    mockFetch(applicationErrorItem);

    await expect(
      getResponse("b6c1a4f0-1234-5678-9abc-def012345678"),
    ).rejects.toBeInstanceOf(JuditApplicationError);
  });
});

describe("listTrackingResponses", () => {
  it("uses the tracking id in the path", async () => {
    const fetchMock = mockFetch(responsesBody);

    await listTrackingResponses({
      trackingId: "cfb61e6e-f2bd-4375-8c87-373405cac6db",
      createdAtGte: "2024-03-05T00:00:00.000Z",
      createdAtLte: "2025-03-11T00:00:00.000Z",
    });

    expect(sentRequest(fetchMock).url.pathname).toBe(
      "/responses/tracking/cfb61e6e-f2bd-4375-8c87-373405cac6db",
    );
  });
});

describe("responseCameFromCache", () => {
  it("prefers the item-level field and returns undefined when absent", () => {
    const base = {
      response_id: "r",
      response_type: "lawsuit",
      response_data: {},
    };
    expect(responseCameFromCache({ ...base, cached_response: true })).toBe(
      true,
    );
    expect(responseCameFromCache({ ...base, cached: false })).toBe(false);
    expect(responseCameFromCache(base)).toBeUndefined();
  });
});
