import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { isDuplicateKeyError } from "@/db/errors";
import { JUDIT_REQUESTS_REQUEST_ID_INDEX } from "@/db/collections";
import { createTestDb } from "@/db/test-db";

import {
  findOpenJuditRequest,
  getJuditRequest,
  listJuditRequests,
  markJuditRequestCompleted,
  OPEN_QUERY_WINDOW_MS,
  saveJuditRequest,
  updateJuditRequestStatus,
  type NewJuditRequest,
} from "./db";

// Same setup as trackings/db.test.ts: a temporary real MongoDB with the
// app's indexes replaces getDb().
const testDb = vi.hoisted(() => ({
  current: undefined as Awaited<ReturnType<typeof createTestDb>> | undefined,
}));
vi.mock("@/db", () => ({ getDb: async () => testDb.current!.db }));

const base: NewJuditRequest = {
  requestId: "84b4d8f5-50f8-4c14-818f-912c722a6908",
  companyId: "company-1",
  mode: "historical_async",
  delivery: "polling",
  searchType: "cnpj",
  searchKey: "A1B2C3D4E5F668",
  cacheTtlInDays: null,
  status: "pending",
};

beforeAll(async () => {
  testDb.current = await createTestDb();
}, 120_000);

beforeEach(async () => {
  await testDb.current!.reset();
});

afterAll(async () => {
  await testDb.current?.close();
});

describe("judit_requests", () => {
  it("saves the explicit mode and lists a company's requests, newest first", async () => {
    await saveJuditRequest(base);
    await saveJuditRequest({
      ...base,
      requestId: "second",
      mode: "historical_on_demand",
      cacheTtlInDays: 7,
    });
    await saveJuditRequest({ ...base, requestId: "other", companyId: "c-2" });

    const list = await listJuditRequests("company-1");

    expect(list.map((r) => [r.requestId, r.mode, r.cacheTtlInDays])).toEqual([
      ["second", "historical_on_demand", 7],
      [base.requestId, "historical_async", null],
    ]);
  });

  it("refuses the same request_id twice at the database level", async () => {
    await saveJuditRequest(base);

    const error = await saveJuditRequest(base).catch((e: unknown) => e);

    expect(isDuplicateKeyError(error, JUDIT_REQUESTS_REQUEST_ID_INDEX)).toBe(
      true,
    );
  });

  it("records the latest status and when it was checked", async () => {
    await saveJuditRequest(base);

    const updated = await updateJuditRequestStatus(base.requestId, "completed");

    expect(updated).toMatchObject({ status: "completed" });
    expect(updated?.lastCheckedAt).toBeInstanceOf(Date);
    expect(await getJuditRequest(base.requestId)).toMatchObject({
      status: "completed",
    });
    expect(await updateJuditRequestStatus("missing", "completed")).toBeNull();
  });
});

describe("findOpenJuditRequest", () => {
  it("finds a pending or started query of the same company and mode", async () => {
    await saveJuditRequest(base);

    expect(
      await findOpenJuditRequest("company-1", "historical_async"),
    ).toMatchObject({ requestId: base.requestId });
    expect(
      await findOpenJuditRequest("company-1", "historical_on_demand"),
    ).toBeNull();
    expect(
      await findOpenJuditRequest("company-2", "historical_async"),
    ).toBeNull();
  });

  it("does not count a completed query", async () => {
    await saveJuditRequest(base);
    await markJuditRequestCompleted(base.requestId);

    expect(
      await findOpenJuditRequest("company-1", "historical_async"),
    ).toBeNull();
  });

  it("stops counting a query that never finished after the window", async () => {
    await saveJuditRequest(base);
    const later = new Date(Date.now() + OPEN_QUERY_WINDOW_MS + 1000);

    expect(
      await findOpenJuditRequest("company-1", "historical_async", later),
    ).toBeNull();
  });
});

describe("markJuditRequestCompleted", () => {
  it("records completed without pretending someone asked JUDIT", async () => {
    await saveJuditRequest(base);

    const updated = await markJuditRequestCompleted(base.requestId);

    expect(updated).toMatchObject({ status: "completed", lastCheckedAt: null });
  });
});
