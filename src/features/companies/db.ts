import "server-only";

import { eq, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { companies, type Company } from "@/db/schema";

import { cnpjSchema, normalizeCnpj } from "./cnpj";

// Persistência de empresas no PostgreSQL. Nada aqui chama a JUDIT: razão
// social e situação cadastral ficam nulas até uma consulta real preenchê-las.

export async function listCompanies(): Promise<Company[]> {
  return getDb()
    .select()
    .from(companies)
    .orderBy(sql`coalesce(${companies.legalName}, ${companies.cnpj})`);
}

export async function getCompanyByCnpj(cnpj: string): Promise<Company | null> {
  const [company] = await getDb()
    .select()
    .from(companies)
    .where(eq(companies.cnpj, normalizeCnpj(cnpj)))
    .limit(1);
  return company ?? null;
}

// Devolve a empresa do CNPJ, criando-a se ainda não existir. Pode ser chamada
// várias vezes, inclusive ao mesmo tempo, sem duplicar: quem decide é a
// restrição UNIQUE de `companies.cnpj`. ON CONFLICT DO NOTHING não devolve
// a linha que já existia, por isso a segunda consulta.
export async function ensureCompany(cnpj: string): Promise<Company> {
  const normalized = cnpjSchema.parse(cnpj);

  const [created] = await getDb()
    .insert(companies)
    .values({ cnpj: normalized })
    .onConflictDoNothing({ target: companies.cnpj })
    .returning();
  if (created) return created;

  const existing = await getCompanyByCnpj(normalized);
  if (!existing) {
    // Só acontece se a empresa for apagada entre as duas consultas.
    throw new Error("Empresa não encontrada logo após o conflito de CNPJ.");
  }
  return existing;
}
