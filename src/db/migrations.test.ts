import { MongoClient, type Db } from "mongodb";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { ensureIndexes } from "./collections";
import { migrateCompaniesToParties } from "./migrations";

// A database in the shape of stage 6 (companies + companyId), migrated as the
// app does on connect: migration first, then indexes.
let server: MongoMemoryServer;
let client: MongoClient;
let db: Db;

const COMPANY_ID = "c0000000-0000-4000-8000-000000000001";
const at = new Date("2026-10-14T12:00:00Z");

beforeAll(async () => {
  server = await MongoMemoryServer.create();
  client = await MongoClient.connect(server.getUri());
}, 120_000);

beforeEach(async () => {
  db = client.db(
    `migration_${Date.now()}_${Math.random().toString(16).slice(2)}`,
  );
  await db.collection("companies").insertOne({
    _id: COMPANY_ID as never,
    cnpj: "A1B2C3D4E5F668",
    legalName: "EMPRESA DE TESTE",
    registrationStatus: "Ativa",
    createdAt: at,
    updatedAt: at,
  });
  await db
    .collection("companies")
    .createIndex({ cnpj: 1 }, { name: "companies_cnpj_unique", unique: true });
  await db.collection("trackings").insertOne({ companyId: COMPANY_ID });
  await db
    .collection("trackings")
    .createIndex({ companyId: 1 }, { name: "trackings_company_id" });
  await db.collection("alerts").insertOne({ companyId: null });
  await db.collection("judit_requests").insertOne({ companyId: COMPANY_ID });
});

afterAll(async () => {
  await client?.close();
  await server?.stop();
});

describe("migrateCompaniesToParties", () => {
  it("copies companies as CNPJ parties with the same id and renames references", async () => {
    await migrateCompaniesToParties(db);
    await ensureIndexes(db);

    expect(
      await db.collection("parties").findOne({ _id: COMPANY_ID as never }),
    ).toMatchObject({
      documentType: "cnpj",
      document: "A1B2C3D4E5F668",
      name: "EMPRESA DE TESTE",
      registrationStatus: "Ativa",
    });
    expect(await db.collection("trackings").findOne()).toMatchObject({
      partyId: COMPANY_ID,
    });
    expect(await db.collection("trackings").findOne()).not.toHaveProperty(
      "companyId",
    );
    expect(await db.collection("alerts").findOne()).toMatchObject({
      partyId: null,
    });
  });

  it("keeps the old collection under another name and drops the old index", async () => {
    await migrateCompaniesToParties(db);

    const names = (await db.listCollections().toArray()).map((c) => c.name);
    expect(names).toContain("companies_migrated");
    expect(names).not.toContain("companies");
    const indexes = (await db.collection("trackings").indexes()).map(
      (index) => index.name,
    );
    expect(indexes).not.toContain("trackings_company_id");
  });

  it("can run again without changing anything", async () => {
    await migrateCompaniesToParties(db);
    await db
      .collection("parties")
      .updateOne(
        { _id: COMPANY_ID as never },
        { $set: { name: "NOME ATUALIZADO" } },
      );

    await migrateCompaniesToParties(db);
    await ensureIndexes(db);

    expect(await db.collection("parties").countDocuments()).toBe(1);
    expect(
      await db.collection("parties").findOne({ _id: COMPANY_ID as never }),
    ).toMatchObject({ name: "NOME ATUALIZADO" });
  });
});
