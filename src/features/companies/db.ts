import "server-only";

import { randomUUID } from "node:crypto";

import { getDb } from "@/db";
import { collections, toModel } from "@/db/collections";
import { isDuplicateKeyError } from "@/db/errors";
import type { Company } from "@/db/models";

import { cnpjSchema, normalizeCnpj } from "./cnpj";

// Persistência de empresas no MongoDB. Nada aqui chama a JUDIT: razão social
// e situação cadastral ficam nulas até uma consulta real preenchê-las.

export async function listCompanies(): Promise<Company[]> {
  const { companies } = collections(await getDb());
  const docs = await companies.find().toArray();
  // Ordenação em memória, com as regras do português (acentos, maiúsculas),
  // igual à demonstração. Suficiente para dezenas de empresas.
  return docs
    .map(toModel)
    .sort((a, b) =>
      (a.legalName ?? a.cnpj).localeCompare(b.legalName ?? b.cnpj, "pt-BR"),
    );
}

export async function getCompanyByCnpj(cnpj: string): Promise<Company | null> {
  const { companies } = collections(await getDb());
  const doc = await companies.findOne({ cnpj: normalizeCnpj(cnpj) });
  return doc ? toModel(doc) : null;
}

// Devolve a empresa do CNPJ, criando-a se ainda não existir. Pode ser chamada
// várias vezes, inclusive ao mesmo tempo, sem duplicar: quem decide é o
// índice único `companies_cnpj_unique`.
export async function ensureCompany(cnpj: string): Promise<Company> {
  const normalized = cnpjSchema.parse(cnpj);
  const { companies } = collections(await getDb());
  const now = new Date();

  try {
    // Upsert: procura pelo CNPJ e, se não achar, insere. $setOnInsert só se
    // aplica na inserção, então uma empresa existente não é alterada.
    const doc = await companies.findOneAndUpdate(
      { cnpj: normalized },
      {
        $setOnInsert: {
          _id: randomUUID(),
          legalName: null,
          registrationStatus: null,
          createdAt: now,
          updatedAt: now,
        },
      },
      { upsert: true, returnDocument: "after" },
    );
    if (doc) return toModel(doc);
  } catch (error) {
    // Dois upserts simultâneos podem tentar inserir juntos; o índice único
    // recusa o segundo, e a empresa criada pelo primeiro é lida abaixo.
    if (!isDuplicateKeyError(error, "companies_cnpj_unique")) throw error;
  }

  const existing = await getCompanyByCnpj(normalized);
  if (!existing) {
    throw new Error("Empresa não encontrada logo após o upsert do CNPJ.");
  }
  return existing;
}
