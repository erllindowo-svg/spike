import "server-only";

import { randomUUID } from "node:crypto";

import { getDb } from "@/db";
import { collections, PARTIES_DOCUMENT_INDEX, toModel } from "@/db/collections";
import { isDuplicateKeyError } from "@/db/errors";
import type { DocumentType, Party } from "@/db/models";
import { refreshSearchEntries } from "@/features/search/refresh";

import { documentSchema, normalizeDocument } from "./documents";

// Persistência das partes (empresas e pessoas físicas) no MongoDB. Nada aqui
// chama a JUDIT: nome e situação cadastral ficam nulos até uma consulta de
// dados cadastrais preenchê-los (src/features/parties/actions.ts).

export async function listParties(): Promise<Party[]> {
  const { parties } = collections(await getDb());
  const docs = await parties.find().toArray();
  // Ordenação em memória, com as regras do português (acentos, maiúsculas).
  // Suficiente para dezenas de partes.
  return docs
    .map(toModel)
    .sort((a, b) =>
      (a.name ?? a.document).localeCompare(b.name ?? b.document, "pt-BR"),
    );
}

export async function getPartyByDocument(
  type: DocumentType,
  document: string,
): Promise<Party | null> {
  const { parties } = collections(await getDb());
  const doc = await parties.findOne({
    documentType: type,
    document: normalizeDocument(type, document),
  });
  return doc ? toModel(doc) : null;
}

// Devolve a parte do documento, criando-a se ainda não existir. Pode ser
// chamada várias vezes, inclusive ao mesmo tempo, sem duplicar: quem decide
// é o índice único `parties_document_unique`.
export async function ensureParty(
  type: DocumentType,
  document: string,
): Promise<Party> {
  const normalized = documentSchema(type).parse(document);
  const { parties } = collections(await getDb());
  const now = new Date();

  try {
    // Upsert: procura pelo documento e, se não achar, insere. $setOnInsert
    // só se aplica na inserção, então uma parte existente não é alterada.
    const doc = await parties.findOneAndUpdate(
      { documentType: type, document: normalized },
      {
        $setOnInsert: {
          _id: randomUUID(),
          name: null,
          registrationStatus: null,
          createdAt: now,
          updatedAt: now,
        },
      },
      { upsert: true, returnDocument: "after" },
    );
    if (doc) {
      await refreshSearchEntries([{ searchType: type, searchKey: normalized }]);
      return toModel(doc);
    }
  } catch (error) {
    // Dois upserts simultâneos podem tentar inserir juntos; o índice único
    // recusa o segundo, e a parte criada pelo primeiro é lida abaixo.
    if (!isDuplicateKeyError(error, PARTIES_DOCUMENT_INDEX)) throw error;
  }

  const existing = await getPartyByDocument(type, normalized);
  if (!existing) {
    throw new Error("Parte não encontrada logo após o upsert do documento.");
  }
  return existing;
}

// Grava o que a consulta de dados cadastrais trouxe. Um campo que a JUDIT
// não devolveu não apaga o valor que a parte já tinha.
export async function updatePartyRegistration(
  id: string,
  data: Pick<Party, "name" | "registrationStatus" | "tradeName">,
): Promise<void> {
  const { parties } = collections(await getDb());
  const set: Partial<Pick<Party, "name" | "registrationStatus" | "tradeName">> =
    {};
  if (data.name) set.name = data.name;
  if (data.tradeName) set.tradeName = data.tradeName;
  if (data.registrationStatus) {
    set.registrationStatus = data.registrationStatus;
  }
  if (Object.keys(set).length === 0) return;
  const doc = await parties.findOneAndUpdate(
    { _id: id },
    { $set: { ...set, updatedAt: new Date() } },
    { returnDocument: "after" },
  );
  // O nome novo passa a ser achado pela barra de pesquisa.
  if (doc) {
    await refreshSearchEntries([
      { searchType: doc.documentType, searchKey: doc.document },
    ]);
  }
}
