import { eq } from "drizzle-orm";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { companies, trackings } from "@/db/schema";
import { createTestDb } from "@/db/test-db";
import {
  ensureCompany,
  getCompanyByCnpj,
  listCompanies,
} from "@/features/companies/db";

import { createTracking, listTrackings } from "./db";

// The app's getDb() is replaced by an in-process PostgreSQL (PGlite) with the
// real migrations applied. vi.hoisted makes `testDb` available to the mock
// factory, which Vitest moves to the top of the file.
const testDb = vi.hoisted(() => ({
  current: undefined as Awaited<ReturnType<typeof createTestDb>> | undefined,
}));
vi.mock("@/db", () => ({ getDb: () => testDb.current!.db }));

// Fictitious identifiers with valid check digits.
const CNPJ = "A1B2C3D4E5F668";
const OTHER_CNPJ = "11222333000181";
const CNJ = "00012340320268260100";

beforeAll(async () => {
  testDb.current = await createTestDb();
});

beforeEach(async () => {
  await testDb.current!.reset();
});

afterAll(async () => {
  await testDb.current?.close();
});

describe("ensureCompany", () => {
  it("creates the company once, however the CNPJ is formatted", async () => {
    const first = await ensureCompany("A1.B2C.3D4/E5F6-68");
    const second = await ensureCompany(CNPJ.toLowerCase());

    expect(second.id).toBe(first.id);
    expect(first.cnpj).toBe(CNPJ);
    expect(await listCompanies()).toHaveLength(1);
  });

  it("does not duplicate when called concurrently", async () => {
    const [a, b] = await Promise.all([
      ensureCompany(CNPJ),
      ensureCompany(CNPJ),
    ]);

    expect(a.id).toBe(b.id);
    expect(await listCompanies()).toHaveLength(1);
  });

  it("rejects an invalid CNPJ", async () => {
    await expect(ensureCompany("A1B2C3D4E5F690")).rejects.toThrow();
    expect(await listCompanies()).toHaveLength(0);
  });
});

describe("createTracking", () => {
  it("stores a CNPJ tracking linked to its company, not sent to JUDIT", async () => {
    const result = await createTracking({
      searchType: "cnpj",
      searchKey: "A1B2C3D4/E5F6-68",
      recurrenceDays: 7,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const company = await getCompanyByCnpj(CNPJ);
    expect(result.tracking).toMatchObject({
      searchType: "cnpj",
      searchKey: CNPJ,
      recurrenceDays: 7,
      companyId: company?.id,
      juditTrackingId: null,
      status: null,
    });
  });

  it("stores a CNJ tracking without a company", async () => {
    const result = await createTracking({
      searchType: "cnj",
      searchKey: "0001234-03.2026.8.26.0100",
      recurrenceDays: 1,
    });

    expect(result).toMatchObject({
      ok: true,
      tracking: { searchKey: CNJ, companyId: null },
    });
    expect(await listCompanies()).toHaveLength(0);
  });

  it.each([
    [
      "invalid CNPJ",
      { searchType: "cnpj", searchKey: "A1B2C3D4E5F690", recurrenceDays: 7 },
    ],
    [
      "invalid CNJ",
      {
        searchType: "cnj",
        searchKey: "0001234-99.2026.8.26.0100",
        recurrenceDays: 7,
      },
    ],
    [
      "zero recurrence",
      { searchType: "cnpj", searchKey: CNPJ, recurrenceDays: 0 },
    ],
    [
      "fractional recurrence",
      { searchType: "cnpj", searchKey: CNPJ, recurrenceDays: 1.5 },
    ],
    [
      "unknown search type",
      { searchType: "cpf", searchKey: "12345678909", recurrenceDays: 7 },
    ],
  ])("rejects %s without touching the database", async (_, input) => {
    const result = await createTracking(input as never);

    expect(result).toMatchObject({ ok: false, reason: "invalid_input" });
    expect(await listTrackings()).toHaveLength(0);
    expect(await listCompanies()).toHaveLength(0);
  });

  it("refuses a second active tracking for the same identifier", async () => {
    await createTracking({
      searchType: "cnpj",
      searchKey: CNPJ,
      recurrenceDays: 7,
    });
    const again = await createTracking({
      searchType: "cnpj",
      searchKey: "A1B2C3D4/E5F6-68",
      recurrenceDays: 30,
    });

    expect(again).toEqual({ ok: false, reason: "duplicate" });
    expect(await listTrackings()).toHaveLength(1);
  });

  it("lets the database decide between two simultaneous requests", async () => {
    const results = await Promise.all([
      createTracking({
        searchType: "cnpj",
        searchKey: CNPJ,
        recurrenceDays: 7,
      }),
      createTracking({
        searchType: "cnpj",
        searchKey: CNPJ,
        recurrenceDays: 7,
      }),
    ]);

    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok)).toEqual([
      { ok: false, reason: "duplicate" },
    ]);
  });

  it("allows the same identifier again once the old tracking is deleted", async () => {
    const first = await createTracking({
      searchType: "cnpj",
      searchKey: CNPJ,
      recurrenceDays: 7,
    });
    if (!first.ok) throw new Error("setup failed");
    await testDb
      .current!.db.update(trackings)
      .set({ status: "deleted" })
      .where(eq(trackings.id, first.tracking.id));

    const second = await createTracking({
      searchType: "cnpj",
      searchKey: CNPJ,
      recurrenceDays: 7,
    });

    expect(second.ok).toBe(true);
    expect(await listTrackings()).toHaveLength(2);
  });

  it("keeps different identifiers independent", async () => {
    const a = await createTracking({
      searchType: "cnpj",
      searchKey: CNPJ,
      recurrenceDays: 7,
    });
    const b = await createTracking({
      searchType: "cnpj",
      searchKey: OTHER_CNPJ,
      recurrenceDays: 7,
    });

    expect(a.ok && b.ok).toBe(true);
    expect(await testDb.current!.db.select().from(companies)).toHaveLength(2);
  });

  it("propagates database failures other than the duplicate rule", async () => {
    // Takes the whole table away to simulate a broken database.
    await testDb.current!.db.execute("DROP TABLE trackings CASCADE");
    try {
      await expect(
        createTracking({
          searchType: "cnj",
          searchKey: CNJ,
          recurrenceDays: 7,
        }),
      ).rejects.toThrow();
    } finally {
      // Recreate a clean database for any test that runs after this one.
      await testDb.current!.close();
      testDb.current = await createTestDb();
    }
  });
});
