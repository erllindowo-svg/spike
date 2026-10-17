import "server-only";

import { randomUUID } from "node:crypto";

import type { Collection, Document, Filter } from "mongodb";

import { getDb } from "@/db";
import {
  collections,
  FINDINGS_KEY_INDEX,
  LAWSUIT_STATS_KEY_INDEX,
  LAWSUITS_KEY_INDEX,
  REGISTRATIONS_KEY_INDEX,
  toModel,
  WARRANTS_KEY_INDEX,
  type StoredLawsuitDoc,
  type StoredRegistrationDoc,
  type StoredWarrantDoc,
} from "@/db/collections";
import { isDuplicateKeyError } from "@/db/errors";
import type { Subject as SearchSubject } from "@/features/search/entries";
import { refreshSearchEntries } from "@/features/search/refresh";
import type {
  Finding,
  LawsuitStats,
  RecordSource,
  SearchType,
  StoredLawsuit,
  StoredRegistration,
  StoredWarrant,
} from "@/db/models";

import type { BaseBatch, BaseRecord, StatsRecord } from "./records";

// Gravação da base própria (círculo 3, fatia 5; decisão D1). Quem chama:
//   consultas síncronas      src/features/consult/actions.ts
//   resultados assíncronos   src/features/queries/actions.ts
//   resultados de monitoramento   src/features/trackings/actions.ts
//   entregas de webhook      src/app/api/webhooks/judit/route.ts
//
// Regra de atualização: o conteúdo mais novo (`fetchedAt`) substitui o
// anterior, com a origem. A JUDIT não manda versão, então "mais novo" é a
// data da resposta (ou a da gravação, quando ela não vem). A regra é
// atômica: o upsert só casa com um registro mais velho; se o existente for
// mais novo, o upsert tenta inserir outro com a mesma chave e o índice
// único recusa. Duas gravações simultâneas não deixam o dado velho por cima.

export type Subject = { searchType: SearchType; searchKey: string };

export type SaveSummary = { saved: number; kept: number };

type RecordDoc = Document & { _id: string; fetchedAt: Date };

async function upsertNewer<T extends RecordDoc>(
  collection: Collection<T>,
  index: string,
  key: Filter<T>,
  fields: Record<string, unknown>,
  meta: { juditData: unknown; source: RecordSource; fetchedAt: Date },
): Promise<"saved" | "kept"> {
  try {
    await collection.updateOne(
      { ...key, fetchedAt: { $lte: meta.fetchedAt } } as Filter<T>,
      {
        $set: { ...fields, ...meta },
        $setOnInsert: { _id: randomUUID(), firstSeenAt: new Date() },
      } as never,
      { upsert: true },
    );
    return "saved";
  } catch (error) {
    if (isDuplicateKeyError(error, index)) return "kept";
    throw error;
  }
}

// A ligação assunto → item. Sempre atualizada (é "encontrado de novo em").
// Duas gravações ao mesmo tempo podem colidir no insert; a segunda tenta
// outra vez, e aí casa com a primeira.
async function upsertFinding(
  subject: Subject,
  record: Pick<BaseRecord, "kind" | "itemKey" | "role">,
  source: RecordSource,
  foundAt: Date,
) {
  const { findings } = collections(await getDb());
  const run = () =>
    findings.updateOne(
      { ...subject, kind: record.kind, itemKey: record.itemKey },
      {
        $set: { role: record.role, source, lastFoundAt: foundAt },
        $setOnInsert: { _id: randomUUID(), firstFoundAt: foundAt },
      },
      { upsert: true },
    );
  try {
    await run();
  } catch (error) {
    if (!isDuplicateKeyError(error, FINDINGS_KEY_INDEX)) throw error;
    await run();
  }
}

export async function saveBatch(
  subject: Subject,
  source: RecordSource,
  batch: BaseBatch,
  fetchedAt: Date = new Date(),
): Promise<SaveSummary> {
  const { lawsuits, registrations, warrants } = collections(await getDb());
  const summary: SaveSummary = { saved: 0, kept: 0 };
  const meta = (juditData: unknown) => ({ juditData, source, fetchedAt });

  for (const record of batch.records) {
    let result: "saved" | "kept";
    if (record.kind === "lawsuit") {
      // O resumo por IA nunca é apagado por uma resposta sem resumo.
      const { aiSummary, ...fields } = record.fields;
      void aiSummary;
      result = await upsertNewer(
        lawsuits,
        LAWSUITS_KEY_INDEX,
        { cnj: record.fields.cnj, instance: record.fields.instance },
        fields,
        meta(record.juditData),
      );
    } else if (record.kind === "registration") {
      result = await upsertNewer(
        registrations,
        REGISTRATIONS_KEY_INDEX,
        {
          documentType: record.fields.documentType,
          document: record.fields.document,
        },
        record.fields,
        meta(record.juditData),
      );
    } else {
      result = await upsertNewer(
        warrants,
        WARRANTS_KEY_INDEX,
        { key: record.fields.key },
        record.fields,
        meta(record.juditData),
      );
    }
    summary[result]++;
    await upsertFinding(subject, record, source, fetchedAt);
  }

  // O resumo vale para o processo pesquisado (consulta por CNJ).
  if (batch.aiSummary && subject.searchType === "cnj") {
    await lawsuits.updateMany(
      { cnj: subject.searchKey },
      { $set: { aiSummary: batch.aiSummary } },
    );
  }
  // A busca: o assunto e cada processo ou cadastro que ele trouxe.
  await refreshSearchEntries([
    subject,
    ...batch.records.flatMap((record): SearchSubject[] =>
      record.kind === "lawsuit"
        ? [{ searchType: "cnj" as const, searchKey: record.fields.cnj }]
        : record.kind === "registration"
          ? [
              {
                searchType: record.fields.documentType,
                searchKey: record.fields.document,
              },
            ]
          : [],
    ),
  ]);
  return summary;
}

export async function saveStats(
  subject: Subject,
  source: RecordSource,
  stats: StatsRecord,
  fetchedAt: Date = new Date(),
): Promise<"saved" | "kept"> {
  const { lawsuitStats } = collections(await getDb());
  const result = await upsertNewer(
    lawsuitStats,
    LAWSUIT_STATS_KEY_INDEX,
    { ...subject, mode: stats.mode },
    { total: stats.total, groups: stats.groups },
    { juditData: stats.juditData, source, fetchedAt },
  );
  await refreshSearchEntries([subject]);
  return result;
}

// A gravação na base não pode desfazer o que a pessoa já recebeu: a
// consulta foi feita (e cobrada). Uma falha aqui só vai para o log, com o
// identificador de suporte, sem dados do processo.
export async function saveQuietly(
  label: string,
  save: () => Promise<unknown>,
): Promise<void> {
  try {
    await save();
  } catch (error) {
    console.error(
      `[base] falha ao gravar na base própria (${label}):`,
      error instanceof Error ? error.message : String(error),
    );
  }
}

// --- Leitura -------------------------------------------------------------

export type SubjectRecords = {
  lawsuits: (StoredLawsuit & { role: Finding["role"] })[];
  registrations: StoredRegistration[];
  warrants: StoredWarrant[];
  stats: LawsuitStats[];
  findings: Finding[];
};

// Tudo o que a base sabe de um assunto: o que foi encontrado ao pesquisá-lo
// e, se ele mesmo é um processo ou um documento, o próprio registro.
export async function getSubjectRecords(
  subject: Subject,
): Promise<SubjectRecords> {
  const db = collections(await getDb());
  const findings = (
    await db.findings.find(subject).sort({ lastFoundAt: -1 }).toArray()
  ).map(toModel);

  const keys = (kind: Finding["kind"]) =>
    findings.filter((f) => f.kind === kind).map((f) => f.itemKey);
  const roles = new Map(
    findings.map((f) => [`${f.kind}:${f.itemKey}`, f.role]),
  );

  const lawsuitKeys = keys("lawsuit").map((key) => {
    const [cnj, instance] = key.split(":");
    return { cnj, instance: Number(instance) };
  });
  // O próprio cadastro do documento pesquisado, além dos encontrados.
  const registrationKeys = [
    ...keys("registration"),
    ...(subject.searchType === "cpf" || subject.searchType === "cnpj"
      ? [`${subject.searchType}:${subject.searchKey}`]
      : []),
  ].map((key) => {
    const [documentType, document] = key.split(":");
    return { documentType: documentType as "cpf" | "cnpj", document };
  });
  const [lawsuits, registrations, warrants, stats] = await Promise.all([
    lawsuitKeys.length > 0 || subject.searchType === "cnj"
      ? db.lawsuits
          .find({
            $or: [
              ...lawsuitKeys,
              ...(subject.searchType === "cnj"
                ? [{ cnj: subject.searchKey }]
                : []),
            ],
          })
          .sort({ lastMovementAt: -1 })
          .toArray()
      : ([] as StoredLawsuitDoc[]),
    registrationKeys.length > 0
      ? db.registrations.find({ $or: registrationKeys }).toArray()
      : ([] as StoredRegistrationDoc[]),
    db.warrants.find({ key: { $in: keys("warrant") } }).toArray() as Promise<
      StoredWarrantDoc[]
    >,
    db.lawsuitStats.find(subject).toArray(),
  ]);

  return {
    lawsuits: lawsuits.map((doc) => ({
      ...toModel(doc),
      role: roles.get(`lawsuit:${doc.cnj}:${doc.instance}`) ?? null,
    })),
    registrations: registrations.map(toModel),
    warrants: warrants.map(toModel),
    stats: stats.map(toModel),
    findings,
  };
}

// "Apagar este assunto": as ligações do assunto e os itens que só ele
// encontrou. Um processo encontrado também por outro assunto continua na
// base. O histórico de consultas (metadados) não é apagado aqui.
export async function deleteSubjectRecords(subject: Subject): Promise<number> {
  const db = collections(await getDb());
  const own = await db.findings.find(subject).toArray();
  let removed = 0;
  for (const finding of own) {
    const others = await db.findings.countDocuments({
      kind: finding.kind,
      itemKey: finding.itemKey,
      _id: { $ne: finding._id },
    });
    if (others > 0) continue;
    removed += await deleteItem(finding.kind, finding.itemKey);
  }
  await db.findings.deleteMany(subject);
  await db.lawsuitStats.deleteMany(subject);
  if (subject.searchType === "cnj") {
    const shared = await db.findings.countDocuments({
      kind: "lawsuit",
      itemKey: { $regex: `^${subject.searchKey}:` },
    });
    if (shared === 0) {
      removed += (await db.lawsuits.deleteMany({ cnj: subject.searchKey }))
        .deletedCount;
    }
  }
  if (subject.searchType === "cpf" || subject.searchType === "cnpj") {
    const shared = await db.findings.countDocuments({
      kind: "registration",
      itemKey: `${subject.searchType}:${subject.searchKey}`,
    });
    if (shared === 0) {
      removed += (
        await db.registrations.deleteMany({
          documentType: subject.searchType,
          document: subject.searchKey,
        })
      ).deletedCount;
    }
  }
  return removed;
}

async function deleteItem(
  kind: Finding["kind"],
  itemKey: string,
): Promise<number> {
  const db = collections(await getDb());
  if (kind === "lawsuit") {
    const [cnj, instance] = itemKey.split(":");
    return (await db.lawsuits.deleteOne({ cnj, instance: Number(instance) }))
      .deletedCount;
  }
  if (kind === "registration") {
    const [documentType, document] = itemKey.split(":");
    return (
      await db.registrations.deleteOne({
        documentType: documentType as never,
        document,
      })
    ).deletedCount;
  }
  return (await db.warrants.deleteOne({ key: itemKey })).deletedCount;
}
