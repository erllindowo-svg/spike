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
import type { RecordSource } from "@/db/models";
import { createTestDb } from "@/db/test-db";

import { deleteSubjectRecords, getSubjectRecords, saveBatch } from "./db";
import { batchFromResponses, registrationRecords } from "./records";

// A temporary real MongoDB (mongodb-memory-server) with the app's indexes,
// as in src/features/trackings/db.test.ts.
const testDb = vi.hoisted(() => ({
  current: undefined as Awaited<ReturnType<typeof createTestDb>> | undefined,
}));
vi.mock("@/db", () => ({ getDb: async () => testDb.current!.db }));

// Fictitious data: the JUDIT test CNPJ and lawsuit numbers made of zeros.
const CNPJ = { searchType: "cnpj" as const, searchKey: "A1B2C3D4E5F668" };
const OAB = { searchType: "oab" as const, searchKey: "123456SP" };
const CNJ = "00000003920268260050";

const source: RecordSource = {
  origin: "async",
  mode: "historical_async",
  reference: "req-1",
};

function lawsuitItem(overrides: Record<string, unknown> = {}) {
  return {
    response_type: "lawsuit",
    response_data: {
      code: "0000000-39.2026.8.26.0050",
      instance: 1,
      tribunal_acronym: "TJSP",
      area: "CIVEL",
      secrecy_level: 0,
      parties: [
        {
          name: "Empresa Fictícia",
          side: "Passive",
          main_document: CNPJ.searchKey,
        },
      ],
      ...overrides,
    },
  };
}

const at = (iso: string) => new Date(iso);

beforeAll(async () => {
  testDb.current = await createTestDb();
}, 120_000);

beforeEach(async () => {
  await testDb.current!.reset();
});

afterAll(async () => {
  await testDb.current?.close();
});

describe("saveBatch", () => {
  it("stores the lawsuit in our format, the JUDIT item and the link", async () => {
    const result = await saveBatch(
      CNPJ,
      source,
      batchFromResponses([lawsuitItem()], CNPJ),
      at("2026-10-17T10:00:00Z"),
    );
    expect(result).toEqual({ saved: 1, kept: 0 });

    const records = await getSubjectRecords(CNPJ);
    expect(records.lawsuits).toHaveLength(1);
    expect(records.lawsuits[0]).toMatchObject({
      cnj: CNJ,
      instance: 1,
      kind: "lawsuit",
      tribunal: "TJSP",
      secrecyLevel: 0,
      role: "passive",
      source,
    });
    expect(records.lawsuits[0].juditData).toMatchObject({ area: "CIVEL" });
    expect(records.findings[0]).toMatchObject({
      kind: "lawsuit",
      itemKey: `${CNJ}:1`,
    });
  });

  it("replaces with newer content and keeps it against older content", async () => {
    await saveBatch(
      CNPJ,
      source,
      batchFromResponses([lawsuitItem({ area: "CIVEL" })], CNPJ),
      at("2026-10-17T10:00:00Z"),
    );
    await saveBatch(
      CNPJ,
      { ...source, reference: "req-2" },
      batchFromResponses([lawsuitItem({ area: "TRABALHISTA" })], CNPJ),
      at("2026-10-17T12:00:00Z"),
    );
    const older = await saveBatch(
      CNPJ,
      { ...source, reference: "req-0" },
      batchFromResponses([lawsuitItem({ area: "PENAL" })], CNPJ),
      at("2026-10-17T08:00:00Z"),
    );

    expect(older).toEqual({ saved: 0, kept: 1 });
    const { lawsuits } = await getSubjectRecords(CNPJ);
    expect(lawsuits).toHaveLength(1);
    expect(lawsuits[0]).toMatchObject({
      area: "TRABALHISTA",
      source: { reference: "req-2" },
      fetchedAt: at("2026-10-17T12:00:00Z"),
    });
  });

  it("links one lawsuit to every subject that found it", async () => {
    await saveBatch(CNPJ, source, batchFromResponses([lawsuitItem()], CNPJ));
    await saveBatch(OAB, source, batchFromResponses([lawsuitItem()], OAB));

    expect(
      await collections(testDb.current!.db).lawsuits.countDocuments(),
    ).toBe(1);
    expect((await getSubjectRecords(OAB)).lawsuits[0].role).toBeNull();
  });

  it("keeps the AI summary when a later answer has none", async () => {
    const subject = { searchType: "cnj" as const, searchKey: CNJ };
    await saveBatch(
      subject,
      { ...source, mode: "lawsuit_async" },
      batchFromResponses(
        [
          lawsuitItem(),
          {
            response_type: "summary",
            response_data: { data: ["<p>Resumo.</p>"] },
          },
        ],
        subject,
      ),
      at("2026-10-17T10:00:00Z"),
    );
    await saveBatch(
      subject,
      { ...source, mode: "lawsuit_async" },
      batchFromResponses([lawsuitItem()], subject),
      at("2026-10-17T11:00:00Z"),
    );

    const { lawsuits } = await getSubjectRecords(subject);
    expect(lawsuits[0].aiSummary).toBe("Resumo.");
  });

  it("stores warrants and penal executions", async () => {
    const subject = { searchType: "rji" as const, searchKey: "0".repeat(20) };
    await saveBatch(
      subject,
      { ...source, mode: "warrant" },
      batchFromResponses(
        [
          {
            response_type: "warrant",
            response_data: { code: "W-1", status: "Pendente de cumprimento" },
          },
          lawsuitItem({ code: "0000000-39.2026.8.26.0050" }),
          { response_type: "application_error", response_data: {} },
        ].map((item, index) =>
          index === 1 ? { ...item, response_type: "execution" } : item,
        ),
        subject,
      ),
    );

    const records = await getSubjectRecords(subject);
    expect(records.warrants).toMatchObject([
      { key: "W-1", status: "Pendente de cumprimento" },
    ]);
    expect(records.lawsuits).toMatchObject([{ kind: "execution" }]);
  });

  it("stores every registration of a name search, keyed by its document", async () => {
    const subject = {
      searchType: "name" as const,
      searchKey: "Empresa Fictícia",
    };
    const batch = {
      records: registrationRecords([
        { main_document: "A1.B2C.3D4/E5F6-68", name: "EMPRESA FICTICIA LTDA" },
        { main_document: "000.000.001-91", name: "PESSOA FICTICIA" },
        { name: "SEM DOCUMENTO" },
      ]),
      aiSummary: null,
    };
    expect(batch.records).toHaveLength(2);
    await saveBatch(
      subject,
      { ...source, origin: "sync", mode: "registration_data" },
      batch,
    );

    const records = await getSubjectRecords(subject);
    expect(records.registrations.map((r) => r.document).sort()).toEqual([
      "00000000191",
      "A1B2C3D4E5F668",
    ]);
    // The company's own subject sees its registration too.
    expect((await getSubjectRecords(CNPJ)).registrations).toHaveLength(1);
  });
});

describe("deleteSubjectRecords", () => {
  it("removes what only this subject found and keeps shared items", async () => {
    await saveBatch(CNPJ, source, batchFromResponses([lawsuitItem()], CNPJ));
    await saveBatch(
      OAB,
      source,
      batchFromResponses(
        [lawsuitItem(), lawsuitItem({ code: "0000001-24.2026.8.26.0050" })],
        OAB,
      ),
    );

    await deleteSubjectRecords(OAB);

    const { lawsuits, findings } = collections(testDb.current!.db);
    expect(await findings.countDocuments(OAB)).toBe(0);
    // The first lawsuit is still found by the CNPJ; the second is gone.
    expect(await lawsuits.countDocuments()).toBe(1);
    expect((await getSubjectRecords(CNPJ)).lawsuits).toHaveLength(1);
  });
});
