import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { Collection } from "mongodb";

import { activeFor, collections } from "@/db/collections";
import { isDuplicateKeyError } from "@/db/errors";
import { createTestDb } from "@/db/test-db";
import {
  ensureCompany,
  getCompanyByCnpj,
  listCompanies,
} from "@/features/companies/db";

import { createTracking, listTrackings } from "./db";

// The app's getDb() is replaced by a temporary real MongoDB server
// (mongodb-memory-server) with the app's indexes. vi.hoisted makes `testDb`
// available to the mock factory, which Vitest moves to the top of the file.
const testDb = vi.hoisted(() => ({
  current: undefined as Awaited<ReturnType<typeof createTestDb>> | undefined,
}));
vi.mock("@/db", () => ({ getDb: async () => testDb.current!.db }));

// Fictitious identifiers with valid check digits.
const CNPJ = "A1B2C3D4E5F668";
const OTHER_CNPJ = "11222333000181";
const CNJ = "00012340320268260100";

const trackingsCollection = () => collections(testDb.current!.db).trackings;

beforeAll(async () => {
  // The first run downloads the mongod binary; later runs use the cache.
  testDb.current = await createTestDb();
}, 120_000);

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
    expect(first).toMatchObject({
      cnpj: CNPJ,
      legalName: null,
      registrationStatus: null,
    });
    expect(await listCompanies()).toHaveLength(1);
  });

  it("does not duplicate when called concurrently", async () => {
    const results = await Promise.all(
      Array.from({ length: 5 }, () => ensureCompany(CNPJ)),
    );

    expect(new Set(results.map((c) => c.id)).size).toBe(1);
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
    // The index helper field stays inside the database.
    expect(result.tracking).not.toHaveProperty("active");
    expect(await listTrackings()).toEqual([result.tracking]);
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

  it("lets the database decide between simultaneous requests", async () => {
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        createTracking({
          searchType: "cnpj",
          searchKey: CNPJ,
          recurrenceDays: 7,
        }),
      ),
    );

    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok)).toEqual(
      Array.from({ length: 4 }, () => ({ ok: false, reason: "duplicate" })),
    );
  });

  it("allows the same identifier again once the old tracking is deleted", async () => {
    const first = await createTracking({
      searchType: "cnpj",
      searchKey: CNPJ,
      recurrenceDays: 7,
    });
    if (!first.ok) throw new Error("setup failed");
    // Whoever changes the status must keep `active` in sync (activeFor).
    await trackingsCollection().updateOne(
      { _id: first.tracking.id },
      { $set: { status: "deleted", active: activeFor("deleted") } },
    );

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
    expect(await listCompanies()).toHaveLength(2);
  });

  it("allows many trackings not yet sent to JUDIT (null juditTrackingId)", async () => {
    await createTracking({
      searchType: "cnpj",
      searchKey: CNPJ,
      recurrenceDays: 7,
    });
    const b = await createTracking({
      searchType: "cnj",
      searchKey: CNJ,
      recurrenceDays: 7,
    });

    expect(b.ok).toBe(true);
  });

  it("propagates database failures other than the duplicate rule", async () => {
    // Simulates the database dropping the connection during the insert.
    const spy = vi
      .spyOn(Collection.prototype, "insertOne")
      .mockRejectedValueOnce(new Error("connection lost"));
    try {
      await expect(
        createTracking({
          searchType: "cnj",
          searchKey: CNJ,
          recurrenceDays: 7,
        }),
      ).rejects.toThrow("connection lost");
    } finally {
      spy.mockRestore();
    }
  });
});

describe("isDuplicateKeyError", () => {
  it("tells apart violations of different unique indexes", async () => {
    const { companies } = collections(testDb.current!.db);
    const doc = {
      cnpj: CNPJ,
      legalName: null,
      registrationStatus: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await companies.insertOne({ _id: "a", ...doc });
    const error = await companies
      .insertOne({ _id: "b", ...doc })
      .catch((e: unknown) => e);

    expect(isDuplicateKeyError(error, "companies_cnpj_unique")).toBe(true);
    expect(
      isDuplicateKeyError(error, "trackings_active_search_key_unique"),
    ).toBe(false);
    expect(
      isDuplicateKeyError(new Error("E11000"), "companies_cnpj_unique"),
    ).toBe(false);
  });
});
