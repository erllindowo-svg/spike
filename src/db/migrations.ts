import type { Db } from "mongodb";

// Migrações de dados. Como ensureIndexes (collections.ts), rodam ao conectar
// e podem rodar de novo sem efeito: cada passo só mexe no que ainda não foi
// migrado.

// Etapa 7, círculo 2 (escolha R2 em docs/etapa-7-escopo.md): a coleção
// "companies" vira "parties", onde cabem empresas e pessoas físicas, e o
// campo de referência `companyId` vira `partyId`.
//
//   1. Cada empresa é copiada como parte do tipo CNPJ, com o MESMO _id: as
//      referências dos monitoramentos, consultas e alertas continuam valendo.
//   2. A coleção antiga é renomeada (não apagada) para companies_migrated:
//      o passo 1 não roda de novo, e os dados originais ficam para conferir.
//   3. `companyId` é renomeado para `partyId` onde ainda existir.
//   4. Os índices antigos sobre `companyId` são removidos. Os novos têm
//      outros nomes: reaproveitar um nome com outro campo faria o MongoDB
//      recusar o createIndex.
export async function migrateCompaniesToParties(db: Db): Promise<void> {
  const legacyExists = await db
    .listCollections({ name: "companies" }, { nameOnly: true })
    .hasNext();

  if (legacyExists) {
    const legacy = db.collection("companies");
    const parties = db.collection("parties");
    for await (const company of legacy.find()) {
      await parties.updateOne(
        { _id: company._id },
        {
          $setOnInsert: {
            documentType: "cnpj",
            document: company.cnpj,
            name: company.legalName ?? null,
            registrationStatus: company.registrationStatus ?? null,
            createdAt: company.createdAt,
            updatedAt: company.updatedAt,
          },
        },
        { upsert: true },
      );
    }
    await legacy.rename("companies_migrated", { dropTarget: true });
  }

  for (const name of [
    "trackings",
    "alerts",
    "judit_requests",
    "sync_queries",
  ]) {
    await db
      .collection(name)
      .updateMany(
        { companyId: { $exists: true } },
        { $rename: { companyId: "partyId" } },
      );
  }

  for (const [collection, index] of [
    ["trackings", "trackings_company_id"],
    ["alerts", "alerts_company_id"],
    ["judit_requests", "judit_requests_company_id_created_at"],
  ]) {
    await dropIndexIfExists(db, collection, index);
  }
}

async function dropIndexIfExists(db: Db, collection: string, index: string) {
  const exists = await db
    .listCollections({ name: collection }, { nameOnly: true })
    .hasNext();
  if (!exists) return;
  const indexes = await db.collection(collection).indexes();
  if (indexes.some((existing) => existing.name === index)) {
    await db.collection(collection).dropIndex(index);
  }
}
