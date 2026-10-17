import { randomUUID } from "node:crypto";

import type { Db } from "mongodb";

import { collections, toModel } from "@/db/collections";
import type { SearchEntry, SearchType } from "@/db/models";

import { buildTerms, escapeRegex, parseQuery, type SearchQuery } from "./terms";

// A coleção `search_entries` (círculo 3B). É derivada: cada entrada é
// RECALCULADA a partir das outras coleções (partes, cadastros, processos,
// consultas, monitoramentos), nunca editada aos pedaços. Por isso a mesma
// função serve para criar, atualizar e apagar: um assunto que não tem mais
// nada no banco perde a entrada.
//
// As funções recebem o `Db` (em vez de chamar getDb) para poderem rodar
// também na conexão, em src/db/index.ts, quando a coleção está vazia.

export type Subject = { searchType: SearchType; searchKey: string };

function latest(...dates: (Date | null | undefined)[]): Date | null {
  const valid = dates.filter((d): d is Date => d instanceof Date);
  return valid.length > 0
    ? new Date(Math.max(...valid.map((d) => d.getTime())))
    : null;
}

// Nomes das partes de um processo, como a JUDIT manda (`parties[].name`), e
// o título do processo (`name`, "Autor X Réu").
function lawsuitTexts(juditData: unknown): string[] {
  if (typeof juditData !== "object" || juditData === null) return [];
  const data = juditData as { name?: unknown; parties?: unknown };
  const texts: string[] = [];
  if (typeof data.name === "string") texts.push(data.name);
  if (Array.isArray(data.parties)) {
    for (const party of data.parties) {
      if (
        typeof party === "object" &&
        party !== null &&
        typeof (party as { name?: unknown }).name === "string"
      ) {
        texts.push((party as { name: string }).name);
      }
    }
  }
  return texts;
}

export async function refreshSearchEntry(
  db: Db,
  subject: Subject,
): Promise<void> {
  const c = collections(db);
  const { searchType, searchKey } = subject;
  const isDocument = searchType === "cpf" || searchType === "cnpj";
  const sort = { sort: { createdAt: -1 as const } };

  const [party, registration, lawsuits, sync, async, tracking, findings] =
    await Promise.all([
      isDocument
        ? c.parties.findOne({ documentType: searchType, document: searchKey })
        : null,
      isDocument
        ? c.registrations.findOne({
            documentType: searchType,
            document: searchKey,
          })
        : null,
      searchType === "cnj"
        ? c.lawsuits.find({ cnj: searchKey }).sort({ fetchedAt: -1 }).toArray()
        : [],
      c.syncQueries.findOne(subject, sort),
      c.juditRequests.findOne(subject, sort),
      c.trackings.findOne(subject as never, { sort: { updatedAt: -1 } }),
      c.findings.find(subject).sort({ lastFoundAt: -1 }).toArray(),
    ]);

  const lastSeenAt = latest(
    party?.updatedAt,
    registration?.fetchedAt,
    lawsuits[0]?.fetchedAt,
    sync?.createdAt,
    async?.createdAt,
    tracking?.updatedAt,
    findings[0]?.lastFoundAt,
  );
  const key = { searchType, searchKey };
  if (!lastSeenAt) {
    // Nada mais no banco sobre este identificador (por exemplo, depois de
    // "Apagar este assunto").
    await c.searchEntries.deleteOne(key);
    return;
  }

  const name =
    party?.name ??
    registration?.name ??
    (searchType === "name" ? searchKey : null);
  const tradeName = registration?.tradeName ?? party?.tradeName ?? null;
  const lawsuit = lawsuits[0];
  const detail =
    searchType === "cnj"
      ? [lawsuit?.tribunal, lawsuit?.area].filter(Boolean).join(" · ") || null
      : (registration?.registrationStatus ?? party?.registrationStatus ?? null);

  const texts = [
    name,
    tradeName,
    ...lawsuits.flatMap((l) => [
      l.tribunal,
      l.area,
      l.className,
      l.subject,
      ...lawsuitTexts(l.juditData),
    ]),
  ];
  // Uma OAB também é achada pelo número sozinho ("123456").
  const keys =
    searchType === "oab"
      ? [searchKey, searchKey.replace(/[A-Z]+$/, "")]
      : [searchKey];

  await c.searchEntries.updateOne(
    key,
    {
      $set: {
        name,
        detail,
        lawsuits: findings.filter((f) => f.kind === "lawsuit").length,
        terms: buildTerms(texts, keys),
        lastSeenAt,
      },
      $setOnInsert: { _id: randomUUID() },
    },
    { upsert: true },
  );
}

// Todos os identificadores que aparecem em alguma coleção.
async function allSubjects(db: Db): Promise<Subject[]> {
  const c = collections(db);
  const pairs = async (
    cursor: Promise<{ searchType: SearchType; searchKey: string }[]>,
  ) => (await cursor).map((p) => `${p.searchType}:${p.searchKey}`);
  const project = { projection: { _id: 0, searchType: 1, searchKey: 1 } };

  const keys = new Set<string>([
    ...(await pairs(c.syncQueries.find({}, project).toArray() as never)),
    ...(await pairs(c.juditRequests.find({}, project).toArray() as never)),
    ...(await pairs(c.trackings.find({}, project).toArray() as never)),
    ...(await pairs(c.findings.find({}, project).toArray() as never)),
    ...(await c.parties.find().toArray()).map(
      (p) => `${p.documentType}:${p.document}`,
    ),
    ...(await c.registrations.find().toArray()).map(
      (r) => `${r.documentType}:${r.document}`,
    ),
    ...(await c.lawsuits.find().toArray()).map((l) => `cnj:${l.cnj}`),
  ]);
  return [...keys].map((key) => {
    const index = key.indexOf(":");
    return {
      searchType: key.slice(0, index) as SearchType,
      searchKey: key.slice(index + 1),
    };
  });
}

export async function rebuildSearchEntries(db: Db): Promise<number> {
  const subjects = await allSubjects(db);
  for (const subject of subjects) await refreshSearchEntry(db, subject);
  return subjects.length;
}

// Na conexão: com a coleção vazia (primeira vez, ou depois de apagada), o
// que já existe no banco entra na busca.
export async function rebuildSearchEntriesIfEmpty(db: Db): Promise<void> {
  const { searchEntries } = collections(db);
  if ((await searchEntries.estimatedDocumentCount()) > 0) return;
  const count = await rebuildSearchEntries(db);
  if (count > 0) console.info(`[search] busca montada: ${count} entrada(s).`);
}

// A busca no banco: as mesmas regras de matchesTerms (terms.ts), em forma
// de filtro. Cada palavra vira /^palavra/, que usa o índice de `terms`.
export function searchFilter(query: SearchQuery) {
  const prefix = (value: string) => new RegExp(`^${escapeRegex(value)}`);
  return {
    $or: [
      ...(query.tokens.length > 0
        ? [{ terms: { $all: query.tokens.map(prefix) } }]
        : []),
      { terms: prefix(query.compact) },
    ],
  };
}

export async function findSearchEntries(
  db: Db,
  text: string,
  limit: number,
): Promise<SearchEntry[]> {
  const query = parseQuery(text);
  if (!query) return [];
  const { searchEntries } = collections(db);
  const docs = await searchEntries
    .find(searchFilter(query))
    .sort({ lastSeenAt: -1 })
    .limit(limit)
    .toArray();
  return docs.map(toModel);
}

export async function getSearchEntry(
  db: Db,
  subject: Subject,
): Promise<SearchEntry | null> {
  const doc = await collections(db).searchEntries.findOne(subject);
  return doc ? toModel(doc) : null;
}
