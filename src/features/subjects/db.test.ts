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
import { saveBatch } from "@/features/base/db";
import { batchFromResponses } from "@/features/base/records";
import { ensureParty } from "@/features/parties/db";
import { saveJuditRequest, saveSyncQuery } from "@/features/queries/db";
import { reserveTracking } from "@/features/trackings/db";

import { deleteSubject } from "./db";

// A temporary real MongoDB with the app's indexes.
const testDb = vi.hoisted(() => ({
  current: undefined as Awaited<ReturnType<typeof createTestDb>> | undefined,
}));
vi.mock("@/db", () => ({ getDb: async () => testDb.current!.db }));

const CNPJ = { searchType: "cnpj" as const, searchKey: "A1B2C3D4E5F668" };
const db = () => collections(testDb.current!.db);

async function seed() {
  await ensureParty("cnpj", CNPJ.searchKey);
  await saveSyncQuery({
    mode: "datalake_sync",
    partyId: null,
    ...CNPJ,
    requestId: null,
    outcome: "ok",
    resultCount: 1,
    errorKind: null,
  });
  await saveBatch(
    CNPJ,
    { origin: "sync", mode: "datalake_sync", reference: null },
    batchFromResponses(
      [
        {
          response_type: "lawsuit",
          response_data: { code: "0000000-39.2026.8.26.0050" },
        },
      ],
      CNPJ,
    ),
  );
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

describe("deleteSubject", () => {
  it("removes the base records, the query history and the saved party", async () => {
    await seed();

    const result = await deleteSubject(CNPJ);

    expect(result).toMatchObject({ ok: true, removedQueries: 1 });
    expect(await db().lawsuits.countDocuments()).toBe(0);
    expect(await db().findings.countDocuments()).toBe(0);
    expect(await db().syncQueries.countDocuments()).toBe(0);
    expect(await db().parties.countDocuments()).toBe(0);
  });

  it("refuses while a tracking is active", async () => {
    await seed();
    await reserveTracking({ ...CNPJ, recurrenceDays: 30 });

    expect(await deleteSubject(CNPJ)).toEqual({
      ok: false,
      reason: "tracking",
    });
    expect(await db().lawsuits.countDocuments()).toBe(1);
  });

  it("refuses while an async query is still open", async () => {
    await seed();
    await saveJuditRequest({
      requestId: "req-1",
      partyId: null,
      mode: "historical_async",
      delivery: "polling",
      ...CNPJ,
      cacheTtlInDays: null,
      status: "pending",
    });

    expect(await deleteSubject(CNPJ)).toEqual({
      ok: false,
      reason: "open_query",
    });
  });
});
