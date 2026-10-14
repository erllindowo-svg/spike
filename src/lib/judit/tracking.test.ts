import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createdCnjTrackingBody,
  createdCnpjTrackingBody,
  pausedTrackingBody,
} from "./__fixtures__/tracking";
import { JuditGuardError } from "./errors";
import {
  createTracking,
  deleteTracking,
  getTracking,
  listTrackings,
  pauseTracking,
  resumeTracking,
  updateTrackingCallbackUrl,
} from "./tracking";

const TEST_CNPJ = "A1B2C3D4/E5F6-68";
const TRACKING_ID = "15d632c6-a2ab-40c1-bfc5-d8f7bf8d8dd9";

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

describe("createTracking", () => {
  it("rejects a CNJ outside the allowlist before fetch runs", async () => {
    const fetchMock = mockFetch(createdCnjTrackingBody, 201);

    await expect(
      createTracking({
        searchType: "lawsuit_cnj",
        searchKey: "1111111-04.1111.1.11.1111",
        recurrence: 1,
      }),
    ).rejects.toBeInstanceOf(JuditGuardError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends recurrence, fixed_time false and no attachments by default", async () => {
    const fetchMock = mockFetch(createdCnpjTrackingBody, 201);

    const tracking = await createTracking({
      searchType: "cnpj",
      searchKey: TEST_CNPJ,
      recurrence: 7,
    });

    const sent = sentRequest(fetchMock);
    expect(sent.url.toString()).toBe(
      "https://tracking.production.judit.io/tracking",
    );
    expect(sent.body).toEqual({
      recurrence: 7,
      fixed_time: false,
      search: { search_type: "cnpj", search_key: TEST_CNPJ },
    });
    expect(tracking).toMatchObject({
      tracking_id: "15d632c6-a2ab-40c1-bfc5-d8f7bf8d8dd9",
      status: "created",
      hour_range: 21,
    });
  });

  it("sends with_attachments and search_params only when asked", async () => {
    const fetchMock = mockFetch(createdCnpjTrackingBody, 201);

    await createTracking({
      searchType: "cnpj",
      searchKey: TEST_CNPJ,
      recurrence: 1,
      withAttachments: true,
      withInferredParties: true,
    });

    expect(sentRequest(fetchMock).body).toMatchObject({
      with_attachments: true,
      search: { search_params: { with_inferred_parties: true } },
    });
  });
});

describe("tracking by id", () => {
  it("gets one tracking", async () => {
    const fetchMock = mockFetch(createdCnjTrackingBody);

    await expect(getTracking(TRACKING_ID)).resolves.toMatchObject({
      status: "created",
    });
    expect(sentRequest(fetchMock)).toMatchObject({ method: "GET" });
  });

  it("updates only the callback_url (recurrence is rejected by JUDIT)", async () => {
    const fetchMock = mockFetch(pausedTrackingBody);

    await updateTrackingCallbackUrl(
      TRACKING_ID,
      "https://exemplo.test/api/webhooks/judit",
    );

    expect(sentRequest(fetchMock)).toMatchObject({
      method: "PATCH",
      body: { callback_url: "https://exemplo.test/api/webhooks/judit" },
    });
    expect(sentRequest(fetchMock).url.pathname).toBe(
      `/tracking/${TRACKING_ID}`,
    );
  });

  it("pauses and resumes with POST on the documented paths", async () => {
    const pauseMock = mockFetch(pausedTrackingBody);
    await expect(pauseTracking(TRACKING_ID)).resolves.toMatchObject({
      status: "paused",
    });
    expect(sentRequest(pauseMock)).toMatchObject({ method: "POST" });
    expect(sentRequest(pauseMock).url.pathname).toBe(
      `/tracking/${TRACKING_ID}/pause`,
    );

    const resumeMock = mockFetch({ ...pausedTrackingBody, status: "updated" });
    await expect(resumeTracking(TRACKING_ID)).resolves.toMatchObject({
      status: "updated",
    });
    expect(sentRequest(resumeMock).url.pathname).toBe(
      `/tracking/${TRACKING_ID}/resume`,
    );
  });

  it("deletes with DELETE", async () => {
    const fetchMock = mockFetch({ ...pausedTrackingBody, status: "deleted" });

    await expect(deleteTracking(TRACKING_ID)).resolves.toMatchObject({
      status: "deleted",
    });
    expect(sentRequest(fetchMock).method).toBe("DELETE");
  });
});

describe("listTrackings", () => {
  it("sends the pagination required by the spec", async () => {
    const fetchMock = mockFetch({
      page: 1,
      page_count: 1,
      all_pages_count: 1,
      all_count: 1,
      page_data: [createdCnjTrackingBody],
    });

    const list = await listTrackings({});

    expect(Object.fromEntries(sentRequest(fetchMock).url.searchParams)).toEqual(
      { page: "1", page_size: "10" },
    );
    expect(list.page_data[0].tracking_id).toBe(
      "d923253e-45c1-46e5-ac70-164839d9851c",
    );
  });
});
