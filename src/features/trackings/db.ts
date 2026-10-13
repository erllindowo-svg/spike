import "server-only";

import { randomUUID } from "node:crypto";

import { z } from "zod";

import { getDb } from "@/db";
import {
  activeFor,
  collections,
  TRACKING_ACTIVE_KEY_INDEX,
  type TrackingDoc,
} from "@/db/collections";
import { isDuplicateKeyError } from "@/db/errors";
import type { Tracking } from "@/db/models";
import { ensureCompany } from "@/features/companies/db";
import { cnpjSchema } from "@/features/companies/cnpj";
import { cnjSchema } from "@/features/processes/cnj";

// Persistência de monitoramentos no MongoDB. Esta etapa só registra o pedido
// localmente: nenhum monitoramento é criado na JUDIT, por isso
// `juditTrackingId` e `status` ficam nulos. A criação real é a etapa 4.

// Validação no servidor, mesmo que o formulário já valide: qualquer pessoa
// pode enviar dados direto para o servidor, sem passar pela interface. Sem
// tabelas com CHECK, como no SQL, esta validação é a única barreira de formato.
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

// Campo a campo, de propósito: `active` é um detalhe do índice e não deve
// chegar à interface, assim como qualquer campo extra que exista no documento.
function toTracking(doc: TrackingDoc): Tracking {
  return {
    id: doc._id,
    juditTrackingId: doc.juditTrackingId,
    companyId: doc.companyId,
    searchType: doc.searchType,
    searchKey: doc.searchKey,
    status: doc.status,
    recurrenceDays: doc.recurrenceDays,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export async function listTrackings(): Promise<Tracking[]> {
  const { trackings } = collections(await getDb());
  const docs = await trackings.find().sort({ updatedAt: -1 }).toArray();
  return docs.map(toTracking);
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

  // Monitorar um CNPJ registra a empresa. Não precisa de transação: se o
  // monitoramento for recusado como duplicado, a empresa criada continua
  // válida e útil. Um CNJ ainda não é ligado a nenhuma empresa, porque não há
  // coleção de processos.
  const companyId =
    searchType === "cnpj" ? (await ensureCompany(searchKey)).id : null;

  const now = new Date();
  const status = null;
  const doc: TrackingDoc = {
    _id: randomUUID(),
    juditTrackingId: null,
    companyId,
    searchType,
    searchKey,
    status,
    recurrenceDays,
    createdAt: now,
    updatedAt: now,
    active: activeFor(status),
  };

  const { trackings } = collections(await getDb());
  try {
    await trackings.insertOne(doc);
    return { ok: true, tracking: toTracking(doc) };
  } catch (error) {
    // A regra de duplicidade é do banco (índice único parcial em
    // collections.ts), não de uma consulta prévia: duas requisições
    // simultâneas não passam.
    if (isDuplicateKeyError(error, TRACKING_ACTIVE_KEY_INDEX)) {
      return { ok: false, reason: "duplicate" };
    }
    throw error;
  }
}
