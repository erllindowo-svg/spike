import { randomUUID } from "node:crypto";

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
import { JuditDailyBudgetError } from "@/lib/judit/errors";

import {
  assertDailyBudget,
  billedCallsToday,
  startOfDayInSaoPaulo,
} from "./budget";

// Same setup as db.test.ts: a temporary real MongoDB replaces getDb().
const testDb = vi.hoisted(() => ({
  current: undefined as Awaited<ReturnType<typeof createTestDb>> | undefined,
}));
vi.mock("@/db", () => ({ getDb: async () => testDb.current!.db }));

const db = () => collections(testDb.current!.db);
// 10:00 in Sao Paulo.
const NOW = new Date("2026-10-16T13:00:00Z");
const YESTERDAY = new Date("2026-10-15T20:00:00-03:00");
const TODAY = new Date("2026-10-16T08:00:00-03:00");

async function seed(at: Date) {
  await db().syncQueries.insertOne({
    _id: randomUUID(),
    mode: "datalake_sync",
    companyId: null,
    searchType: "cnpj",
    searchKey: "A1B2C3D4E5F668",
    requestId: null,
    outcome: "ok",
    resultCount: 1,
    errorKind: null,
    createdAt: at,
  });
  await db().juditRequests.insertOne({
    _id: randomUUID(),
    requestId: randomUUID(),
    companyId: "company-1",
    mode: "historical_async",
    delivery: "polling",
    searchType: "cnpj",
    searchKey: "A1B2C3D4E5F668",
    cacheTtlInDays: null,
    status: "pending",
    createdAt: at,
    updatedAt: at,
    lastCheckedAt: null,
  });
  for (const juditTrackingId of [randomUUID(), null]) {
    await db().trackings.insertOne({
      _id: randomUUID(),
      juditTrackingId,
      companyId: null,
      mode: "tracking_document",
      searchType: "cnpj",
      searchKey: `KEY${randomUUID()}`,
      creation: juditTrackingId ? "confirmed" : "pending",
      creationError: null,
      status: null,
      recurrenceDays: 30,
      hourRange: null,
      delivery: "webhook",
      createdAt: at,
      updatedAt: at,
      lastCheckedAt: null,
      active: true,
    });
  }
}

beforeAll(async () => {
  testDb.current = await createTestDb();
}, 120_000);

beforeEach(async () => {
  await testDb.current!.reset();
});

afterAll(async () => {
  await testDb.current?.close();
});

describe("daily budget", () => {
  it("starts the day at midnight in Sao Paulo", () => {
    expect(startOfDayInSaoPaulo(NOW).toISOString()).toBe(
      "2026-10-16T03:00:00.000Z",
    );
    // 01:30 UTC on the 17th is still the 16th in Sao Paulo.
    expect(
      startOfDayInSaoPaulo(new Date("2026-10-17T01:30:00Z")).toISOString(),
    ).toBe("2026-10-16T03:00:00.000Z");
  });

  it("counts today's billed calls: sync, async and confirmed trackings", async () => {
    await seed(YESTERDAY);
    await seed(TODAY);

    // Per day: one sync query, one async request, one confirmed tracking
    // (the pending reservation was never sent, so it is not billed).
    expect(await billedCallsToday(NOW)).toBe(3);
  });

  it("refuses at the limit and tells how many were used", async () => {
    vi.stubEnv("JUDIT_DAILY_CALL_LIMIT", "3");
    await seed(TODAY);

    const error = await assertDailyBudget(NOW).catch((caught) => caught);
    expect(error).toBeInstanceOf(JuditDailyBudgetError);
    expect(error).toMatchObject({ limit: 3, used: 3 });
  });

  it("allows while below the limit", async () => {
    vi.stubEnv("JUDIT_DAILY_CALL_LIMIT", "4");
    await seed(TODAY);

    await expect(assertDailyBudget(NOW)).resolves.toBeUndefined();
  });
});
