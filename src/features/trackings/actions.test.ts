import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { collections } from "@/db/collections";
import { createTestDb } from "@/db/test-db";
import {
  createdCnpjTrackingBody,
  pausedTrackingBody,
} from "@/lib/judit/__fixtures__/tracking";
import { responsesBody } from "@/lib/judit/__fixtures__/requests";

import {
  createTrackingAction,
  deleteTrackingAction,
  discardTrackingAction,
  pauseTrackingAction,
  sendTrackingAction,
  trackingResultsAction,
} from "./actions";

// End-to-end on the server side: a temporary real MongoDB (with the app's
// indexes) and the real JUDIT client; only fetch is mocked. The reservation
// rules live in the database, so they are tested against a real one.
// refresh() only works inside a real Next.js request.
const testDb = vi.hoisted(() => ({
  current: undefined as Awaited<ReturnType<typeof createTestDb>> | undefined,
}));
vi.mock("@/db", () => ({ getDb: async () => testDb.current!.db }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));

const CNPJ = "A1B2C3D4E5F668";
const TRACKING_ID = createdCnpjTrackingBody.tracking_id;
const input = {
  searchType: "cnpj",
  searchKey: "A1B2C3D4/E5F6-68",
  recurrenceDays: 30,
} as const;

const trackingsCollection = () => collections(testDb.current!.db).trackings;

// Answers each fetch with the next item: a body (HTTP 200/201), a
// [status, body] pair, or an Error to simulate a network failure.
function mockFetch(...answers: unknown[]) {
  const queue = [...answers];
  const fetchMock = vi.fn(async () => {
    const next = queue.shift();
    if (next instanceof Error) throw next;
    const [status, body] = Array.isArray(next) ? next : [201, next];
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function call(fetchMock: ReturnType<typeof mockFetch>, index = 0) {
  const [url, init] = fetchMock.mock.calls[index] as unknown as [
    URL,
    RequestInit,
  ];
  return {
    url: String(url),
    method: init.method,
    body: init.body ? JSON.parse(String(init.body)) : undefined,
  };
}

async function createConfirmed() {
  mockFetch(createdCnpjTrackingBody);
  const result = await createTrackingAction(input);
  if (!result.ok) throw new Error("setup failed");
  return result.tracking;
}

beforeAll(async () => {
  testDb.current = await createTestDb();
}, 120_000);

beforeEach(async () => {
  await testDb.current!.reset();
  vi.stubEnv("DATA_SOURCE", "db");
  vi.stubEnv("JUDIT_LIVE_CALLS", "enabled");
  vi.stubEnv("JUDIT_API_KEY", "test-key");
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterAll(async () => {
  await testDb.current?.close();
});

describe("createTrackingAction", () => {
  it("refuses to write in demo mode, even when called directly", async () => {
    vi.stubEnv("DATA_SOURCE", "demo");
    const fetchMock = mockFetch();

    expect(await createTrackingAction(input)).toEqual({
      ok: false,
      reason: "unavailable",
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await trackingsCollection().countDocuments()).toBe(0);
  });

  it("reserves, sends the documented body and confirms with the tracking_id", async () => {
    const fetchMock = mockFetch(createdCnpjTrackingBody);

    const result = await createTrackingAction(input);

    expect(call(fetchMock)).toMatchObject({
      method: "POST",
      body: {
        recurrence: 30,
        fixed_time: false,
        search: { search_type: "cnpj", search_key: CNPJ },
      },
    });
    expect(result).toMatchObject({
      ok: true,
      outcome: "confirmed",
      tracking: {
        mode: "tracking_document",
        creation: "confirmed",
        juditTrackingId: TRACKING_ID,
        status: "created",
        hourRange: 21,
        delivery: "polling",
      },
    });
  });

  it("refuses a duplicate BEFORE calling JUDIT again", async () => {
    await createConfirmed();
    const fetchMock = mockFetch(createdCnpjTrackingBody);

    expect(await createTrackingAction(input)).toEqual({
      ok: false,
      reason: "duplicate",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps the reservation pending when live calls are off", async () => {
    vi.stubEnv("JUDIT_LIVE_CALLS", "");
    const fetchMock = mockFetch();

    const result = await createTrackingAction(input);

    expect(result).toMatchObject({
      ok: true,
      outcome: "not_sent",
      tracking: { creation: "pending", juditTrackingId: null },
    });
    expect(fetchMock).not.toHaveBeenCalled();

    // Later, with live calls on, the same reservation is sent.
    vi.stubEnv("JUDIT_LIVE_CALLS", "enabled");
    mockFetch(createdCnpjTrackingBody);
    const id = result.ok ? result.tracking.id : "";
    expect(await sendTrackingAction(id)).toMatchObject({
      ok: true,
      tracking: { creation: "confirmed", juditTrackingId: TRACKING_ID },
    });
  });

  it("marks a JUDIT refusal (4xx) as failed and frees the identifier", async () => {
    mockFetch([400, { error: { name: "HttpBadRequestError" } }]);

    expect(await createTrackingAction(input)).toMatchObject({
      ok: true,
      outcome: "failed",
      tracking: { creation: "failed" },
    });

    // Nothing was created at JUDIT, so a new attempt is allowed.
    mockFetch(createdCnpjTrackingBody);
    expect(await createTrackingAction(input)).toMatchObject({
      outcome: "confirmed",
    });
  });

  it.each([
    ["a network failure", new Error("socket hang up")],
    ["a server error (5xx)", [502, { error: { name: "BadGateway" } }]],
  ])(
    "marks %s as uncertain and keeps the identifier blocked",
    async (_label, answer) => {
      mockFetch(answer);

      expect(await createTrackingAction(input)).toMatchObject({
        ok: true,
        outcome: "uncertain",
        tracking: { creation: "uncertain" },
      });

      // It may exist at JUDIT: a second one could double the recurring cost.
      const fetchMock = mockFetch(createdCnpjTrackingBody);
      expect(await createTrackingAction(input)).toEqual({
        ok: false,
        reason: "duplicate",
      });
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );
});

describe("reservations from stage 2", () => {
  it("sends a stored record that has no stage 4 fields", async () => {
    await trackingsCollection().insertOne({
      _id: "legacy-1",
      juditTrackingId: null,
      companyId: null,
      searchType: "cnpj",
      searchKey: CNPJ,
      status: null,
      recurrenceDays: 7,
      createdAt: new Date(),
      updatedAt: new Date(),
      active: true,
    });
    const fetchMock = mockFetch(createdCnpjTrackingBody);

    const result = await sendTrackingAction("legacy-1");

    expect(call(fetchMock).body.recurrence).toBe(7);
    expect(result).toMatchObject({
      ok: true,
      tracking: {
        mode: "tracking_document",
        creation: "confirmed",
        juditTrackingId: TRACKING_ID,
      },
    });
  });

  it("only sends a reservation once, even with two clicks at the same time", async () => {
    vi.stubEnv("JUDIT_LIVE_CALLS", "");
    const reserved = await createTrackingAction(input);
    const id = reserved.ok ? reserved.tracking.id : "";
    vi.stubEnv("JUDIT_LIVE_CALLS", "enabled");
    const fetchMock = mockFetch(
      createdCnpjTrackingBody,
      createdCnpjTrackingBody,
    );

    const results = await Promise.all([
      sendTrackingAction(id),
      sendTrackingAction(id),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
  });

  it("discards only reservations that were never sent", async () => {
    vi.stubEnv("JUDIT_LIVE_CALLS", "");
    const reserved = await createTrackingAction(input);
    const pendingId = reserved.ok ? reserved.tracking.id : "";
    expect(await discardTrackingAction(pendingId)).toEqual({ ok: true });
    expect(await trackingsCollection().countDocuments()).toBe(0);

    vi.stubEnv("JUDIT_LIVE_CALLS", "enabled");
    const confirmed = await createConfirmed();
    expect(await discardTrackingAction(confirmed.id)).toMatchObject({
      ok: false,
      reason: "invalid",
    });
  });
});

describe("confirmed trackings", () => {
  it("pauses through JUDIT and stores the new status", async () => {
    const tracking = await createConfirmed();
    const fetchMock = mockFetch([200, pausedTrackingBody]);

    const result = await pauseTrackingAction(tracking.id);

    expect(call(fetchMock)).toMatchObject({
      method: "POST",
      url: expect.stringContaining(`/tracking/${TRACKING_ID}/pause`),
    });
    expect(result).toMatchObject({ ok: true, tracking: { status: "paused" } });
  });

  it("refuses ids that are not confirmed trackings of this app, without calling JUDIT", async () => {
    vi.stubEnv("JUDIT_LIVE_CALLS", "");
    const reserved = await createTrackingAction(input);
    vi.stubEnv("JUDIT_LIVE_CALLS", "enabled");
    const fetchMock = mockFetch();

    for (const id of [
      "someone-elses",
      reserved.ok ? reserved.tracking.id : "",
    ]) {
      expect(await pauseTrackingAction(id)).toMatchObject({
        ok: false,
        reason: "invalid",
      });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("deletes through JUDIT, keeps the record and frees the identifier", async () => {
    const tracking = await createConfirmed();
    mockFetch([200, { ...createdCnpjTrackingBody, status: "deleted" }]);

    expect(await deleteTrackingAction(tracking.id)).toMatchObject({
      ok: true,
      tracking: { status: "deleted" },
    });
    expect(await trackingsCollection().countDocuments()).toBe(1);

    mockFetch({ ...createdCnpjTrackingBody, tracking_id: "new-tracking" });
    expect(await createTrackingAction(input)).toMatchObject({
      outcome: "confirmed",
    });
  });

  it("reads the results with the required date range", async () => {
    const tracking = await createConfirmed();
    const fetchMock = mockFetch([200, responsesBody]);

    const result = await trackingResultsAction(tracking.id);

    const { url } = call(fetchMock);
    expect(url).toContain(`/responses/tracking/${TRACKING_ID}`);
    expect(url).toMatch(/created_at_gte=\d{4}-\d{2}-\d{2}T00%3A00%3A00/);
    expect(url).toMatch(/created_at_lte=\d{4}-\d{2}-\d{2}T00%3A00%3A00/);
    expect(result).toMatchObject({
      ok: true,
      results: {
        totalResponses: 1,
        lawsuits: [{ cnj: "99999999999999999999" }],
      },
    });
  });
});
