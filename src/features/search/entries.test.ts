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
import { ensureParty, updatePartyRegistration } from "@/features/parties/db";
import { saveSyncQuery } from "@/features/queries/db";
import { deleteSubject } from "@/features/subjects/db";

import {
  findSearchEntries,
  getSearchEntry,
  rebuildSearchEntriesIfEmpty,
} from "./entries";

// A temporary real MongoDB with the app's indexes; the app's getDb() points
// to it, so the refresh after each write runs for real.
const testDb = vi.hoisted(() => ({
  current: undefined as Awaited<ReturnType<typeof createTestDb>> | undefined,
}));
vi.mock("@/db", () => ({ getDb: async () => testDb.current!.db }));

// Fictitious data only.
const CNPJ = { searchType: "cnpj" as const, searchKey: "A1B2C3D4E5F668" };
const CNJ = "00000003920268260050";
const db = () => testDb.current!.db;
const find = (text: string) => findSearchEntries(db(), text, 8);

async function seed() {
  const party = await ensureParty("cnpj", CNPJ.searchKey);
  await updatePartyRegistration(party.id, {
    name: "Empresa Fictícia Ltda.",
    registrationStatus: "Ativa",
    tradeName: null,
  });
  await saveSyncQuery({
    mode: "datalake_sync",
    partyId: party.id,
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
          response_data: {
            code: "0000000-39.2026.8.26.0050",
            tribunal_acronym: "TJSP",
            area: "Cível",
            parties: [{ name: "Erllan Fictício de Teste" }],
          },
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

describe("search_entries", () => {
  it("keeps one entry per subject and per stored lawsuit", async () => {
    await seed();

    expect(await getSearchEntry(db(), CNPJ)).toMatchObject({
      name: "Empresa Fictícia Ltda.",
      detail: "Ativa",
      lawsuits: 1,
    });
    expect(
      await getSearchEntry(db(), { searchType: "cnj", searchKey: CNJ }),
    ).toMatchObject({ detail: "TJSP · Cível", lawsuits: 0 });
  });

  it("finds by the beginning of a word, inside the stored data", async () => {
    await seed();

    // A party name that only exists inside the stored lawsuit.
    expect((await find("erl")).map((e) => e.searchKey)).toEqual([CNJ]);
    expect((await find("empresa fic")).map((e) => e.searchKey)).toEqual([
      CNPJ.searchKey,
    ]);
    expect(await find("fictic")).toHaveLength(2);
    expect(await find("llan")).toEqual([]);
  });

  it("finds a key typed with its mask", async () => {
    await seed();
    expect((await find("A1.B2C.3D4/E5F6")).map((e) => e.searchKey)).toEqual([
      CNPJ.searchKey,
    ]);
  });

  it("drops the entries of what a deleted subject took with it", async () => {
    await seed();

    await deleteSubject(CNPJ);

    expect(await collections(db()).searchEntries.countDocuments()).toBe(0);
  });

  it("is rebuilt from the other collections when empty", async () => {
    await seed();
    await collections(db()).searchEntries.deleteMany({});

    await rebuildSearchEntriesIfEmpty(db());

    expect(await collections(db()).searchEntries.countDocuments()).toBe(2);
  });
});
