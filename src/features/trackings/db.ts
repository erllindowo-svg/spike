import "server-only";

import { desc } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/db";
import { isUniqueViolation } from "@/db/errors";
import { trackings, type Tracking } from "@/db/schema";
import { ensureCompany } from "@/features/companies/db";
import { cnpjSchema } from "@/features/companies/cnpj";
import { cnjSchema } from "@/features/processes/cnj";

// Persistência de monitoramentos no PostgreSQL. Esta etapa só registra o
// pedido localmente: nenhum monitoramento é criado na JUDIT, por isso
// `juditTrackingId` e `status` ficam nulos. A criação real é a etapa 4.

// Validação no servidor, mesmo que o formulário já valide: qualquer pessoa
// pode enviar dados direto para o servidor, sem passar pela interface.
// A recorrência é obrigatória e sem padrão, como no client da JUDIT, porque
// define com que frequência o monitoramento roda (e custa).
const recurrenceDaysSchema = z.number().int().positive();

const newTrackingSchema = z.discriminatedUnion("searchType", [
  z.object({
    searchType: z.literal("cnpj"),
    searchKey: cnpjSchema,
    recurrenceDays: recurrenceDaysSchema,
  }),
  z.object({
    searchType: z.literal("cnj"),
    searchKey: cnjSchema,
    recurrenceDays: recurrenceDaysSchema,
  }),
]);

export type NewTrackingRequest = z.input<typeof newTrackingSchema>;

export type CreateTrackingResult =
  | { ok: true; tracking: Tracking }
  | { ok: false; reason: "invalid_input"; issues: string[] }
  | { ok: false; reason: "duplicate" };

export async function listTrackings(): Promise<Tracking[]> {
  return getDb().select().from(trackings).orderBy(desc(trackings.updatedAt));
}

export async function createTracking(
  input: NewTrackingRequest,
): Promise<CreateTrackingResult> {
  const parsed = newTrackingSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      reason: "invalid_input",
      issues: parsed.error.issues.map(
        (issue) => `${issue.path.join(".") || "(raiz)"}: ${issue.message}`,
      ),
    };
  }
  const { searchType, searchKey, recurrenceDays } = parsed.data;

  // Monitorar um CNPJ registra a empresa. Fica fora de uma transação de
  // propósito: se o monitoramento for recusado como duplicado, a empresa
  // criada continua válida e útil. Um CNJ ainda não é ligado a nenhuma
  // empresa, porque não há tabela de processos.
  const companyId =
    searchType === "cnpj" ? (await ensureCompany(searchKey)).id : null;

  try {
    const [tracking] = await getDb()
      .insert(trackings)
      .values({ searchType, searchKey, recurrenceDays, companyId })
      .returning();
    return { ok: true, tracking };
  } catch (error) {
    // A regra de duplicidade é do banco (índice único parcial em schema.ts),
    // não de uma consulta prévia: duas requisições simultâneas não passam.
    if (isUniqueViolation(error, "trackings_active_search_key_unique")) {
      return { ok: false, reason: "duplicate" };
    }
    throw error;
  }
}
