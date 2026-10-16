import "server-only";

import { randomUUID } from "node:crypto";

import type { Filter } from "mongodb";
import { z } from "zod";

import { getDb } from "@/db";
import {
  activeFor,
  collections,
  TRACKING_ACTIVE_KEY_INDEX,
  type TrackingDoc,
} from "@/db/collections";
import { isDuplicateKeyError } from "@/db/errors";
import type { Tracking, TrackingCreation } from "@/db/models";
import { ensureParty } from "@/features/parties/db";
import { cnpjSchema } from "@/features/parties/cnpj";
import { cpfSchema } from "@/features/parties/cpf";
import { cnjSchema } from "@/features/processes/cnj";
import { trackingModeFor } from "@/features/queries/modes";

// Persistência de monitoramentos no MongoDB.
//
// Criar um monitoramento real tem dois passos (etapa 4):
//   1. reserveTracking grava uma RESERVA (`creation: "pending"`). O índice
//      único barra um segundo monitoramento ativo para o mesmo identificador
//      ANTES de qualquer chamada cobrada à JUDIT.
//   2. A server action envia a reserva (claimReservation) e registra o
//      resultado (confirmReservation, failReservation...).
// Um monitoramento duplicado na JUDIT custaria em dobro a cada recorrência;
// por isso a proteção vem antes da chamada, e não depois.

// Validação no servidor, mesmo que o formulário já valide: qualquer pessoa
// pode enviar dados direto para o servidor, sem passar pela interface. Sem
// tabelas com CHECK, como no SQL, esta validação é a única barreira de formato.
// A recorrência é obrigatória e sem padrão, como no client da JUDIT, porque
// define com que frequência o monitoramento roda (e custa).
const recurrenceDaysSchema = z.number().int().positive();

// Termos que filtram as movimentações avisadas (só monitoramento por CNJ).
// Limites nossos: a documentação não define tamanho nem quantidade.
export const stepTermsSchema = z
  .array(z.string().trim().min(2).max(60))
  .min(1)
  .max(10);

const newTrackingSchema = z.discriminatedUnion("searchType", [
  z.object({
    searchType: z.literal("cnpj"),
    searchKey: cnpjSchema,
    recurrenceDays: recurrenceDaysSchema,
  }),
  z.object({
    searchType: z.literal("cpf"),
    searchKey: cpfSchema,
    recurrenceDays: recurrenceDaysSchema,
  }),
  z.object({
    searchType: z.literal("cnj"),
    searchKey: cnjSchema,
    recurrenceDays: recurrenceDaysSchema,
    stepTerms: stepTermsSchema.optional(),
  }),
]);

export type NewTrackingRequest = z.input<typeof newTrackingSchema>;

export type CreateTrackingResult =
  | { ok: true; tracking: Tracking }
  | { ok: false; reason: "invalid_input"; issues: string[] }
  | { ok: false; reason: "duplicate" };

// Campo a campo, de propósito: `active` é um detalhe do índice e não deve
// chegar à interface, assim como qualquer campo extra que exista no documento.
//
// Documentos da etapa 2 não têm os campos da etapa 4. Os valores aplicados
// aqui são os equivalentes: um registro sem ID da JUDIT nunca foi enviado,
// então é uma reserva pendente.
function toTracking(doc: TrackingDoc): Tracking {
  return {
    id: doc._id,
    juditTrackingId: doc.juditTrackingId,
    partyId: doc.partyId,
    mode: doc.mode ?? trackingModeFor(doc.searchType),
    searchType: doc.searchType,
    searchKey: doc.searchKey,
    creation: doc.creation ?? (doc.juditTrackingId ? "confirmed" : "pending"),
    creationError: doc.creationError ?? null,
    status: doc.status,
    recurrenceDays: doc.recurrenceDays,
    hourRange: doc.hourRange ?? null,
    delivery: doc.delivery ?? "polling",
    stepTerms: doc.stepTerms ?? null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    lastCheckedAt: doc.lastCheckedAt ?? null,
  };
}

export async function listTrackings(): Promise<Tracking[]> {
  const { trackings } = collections(await getDb());
  const docs = await trackings.find().sort({ updatedAt: -1 }).toArray();
  return docs.map(toTracking);
}

export async function reserveTracking(
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
  const stepTerms =
    parsed.data.searchType === "cnj" ? (parsed.data.stepTerms ?? null) : null;

  // Monitorar um documento (CNPJ ou CPF) registra a parte. Não precisa de
  // transação: se o monitoramento for recusado como duplicado, a parte criada
  // continua válida e útil. Um CNJ ainda não é ligado a nenhuma parte,
  // porque não há coleção de processos.
  const partyId =
    searchType === "cnj" ? null : (await ensureParty(searchType, searchKey)).id;

  const now = new Date();
  const doc: TrackingDoc = {
    _id: randomUUID(),
    juditTrackingId: null,
    partyId,
    mode: trackingModeFor(searchType),
    searchType,
    searchKey,
    creation: "pending",
    creationError: null,
    status: null,
    recurrenceDays,
    hourRange: null,
    delivery: "polling",
    stepTerms,
    createdAt: now,
    updatedAt: now,
    lastCheckedAt: null,
    active: true,
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

export async function getStoredTracking(id: string): Promise<Tracking | null> {
  const { trackings } = collections(await getDb());
  const doc = await trackings.findOne({ _id: id });
  return doc ? toTracking(doc) : null;
}

// Busca pelo tracking_id da JUDIT (o `reference_id` de um webhook de
// monitoramento). Só monitoramentos que a JUDIT confirmou têm esse ID.
export async function getTrackingByJuditId(
  juditTrackingId: string,
): Promise<Tracking | null> {
  const { trackings } = collections(await getDb());
  const doc = await trackings.findOne({ juditTrackingId });
  return doc ? toTracking(doc) : null;
}

// A JUDIT avisou pelo webhook que pausou o monitoramento (application_info,
// códigos 700 a 703). Grava o status que GET /tracking/{id} devolveria
// ("paused"), sem mexer em `lastCheckedAt`: ninguém perguntou à JUDIT.
// Limite conhecido: um aviso atrasado, que chegue depois de a pessoa
// reativar o monitoramento, o marcaria como pausado de novo. "Atualizar
// status" no menu do monitoramento corrige pelo que a JUDIT informa.
export async function markTrackingPausedByJudit(
  id: string,
): Promise<Tracking | null> {
  const { trackings } = collections(await getDb());
  const doc = await trackings.findOneAndUpdate(
    { _id: id, creation: "confirmed" },
    { $set: { status: "paused", updatedAt: new Date() } },
    { returnDocument: "after" },
  );
  return doc ? toTracking(doc) : null;
}

// Filtro de "reserva pendente": inclui documentos da etapa 2, que não têm o
// campo `creation`.
const pendingReservation: Filter<TrackingDoc> = {
  juditTrackingId: null,
  $or: [{ creation: "pending" }, { creation: { $exists: false } }],
};

// Marca a reserva como "em envio" numa única operação atômica: se dois
// cliques chegarem juntos, só um encontra a reserva pendente e envia. O
// outro recebe null.
export async function claimReservation(id: string): Promise<Tracking | null> {
  const { trackings } = collections(await getDb());
  const doc = await trackings.findOneAndUpdate(
    { _id: id, ...pendingReservation },
    {
      $set: { creation: "sending", creationError: null, updatedAt: new Date() },
    },
    { returnDocument: "after" },
  );
  return doc ? toTracking(doc) : null;
}

// Dados que a JUDIT devolve sobre um monitoramento e que guardamos.
export type RemoteTrackingFields = {
  status: string;
  recurrenceDays?: number;
  hourRange?: number;
};

export async function confirmReservation(
  id: string,
  juditTrackingId: string,
  remote: RemoteTrackingFields,
): Promise<Tracking | null> {
  return setCreation(id, "confirmed", null, {
    juditTrackingId,
    ...remoteFields(remote),
  });
}

// A JUDIT recusou: nada foi criado e o identificador fica livre.
export async function failReservation(
  id: string,
  reason: string,
): Promise<Tracking | null> {
  return setCreation(id, "failed", reason);
}

// Sem resposta clara: pode existir na JUDIT. O identificador continua
// bloqueado até alguém conferir.
export async function markReservationUncertain(
  id: string,
  reason: string,
): Promise<Tracking | null> {
  return setCreation(id, "uncertain", reason);
}

// Nada saiu do nosso servidor (chamadas reais desligadas, allowlist): a
// reserva volta a ficar pendente e pode ser enviada depois.
export async function releaseReservation(
  id: string,
  reason: string,
): Promise<Tracking | null> {
  return setCreation(id, "pending", reason);
}

// --- Conferência de um envio incerto -------------------------------------
//
// Depois de procurar o monitoramento em GET /tracking (reconcileTrackingAction),
// o resultado da conferência substitui o estado incerto. Também vale para um
// registro preso em "sending" (o servidor caiu no meio do envio).
const UNRESOLVED: TrackingCreation[] = ["sending", "uncertain"];

// Encontrado na JUDIT: o envio tinha dado certo.
export async function confirmUncertainReservation(
  id: string,
  juditTrackingId: string,
  remote: RemoteTrackingFields,
): Promise<Tracking | null> {
  return setCreation(
    id,
    "confirmed",
    null,
    { juditTrackingId, ...remoteFields(remote) },
    UNRESOLVED,
  );
}

// Não existe na JUDIT: nada foi criado. A reserva volta a ficar pendente,
// como se nunca tivesse sido enviada; pode ser enviada de novo ou descartada.
export async function reopenUncertainReservation(
  id: string,
  reason: string,
): Promise<Tracking | null> {
  return setCreation(id, "pending", reason, {}, UNRESOLVED);
}

// Apaga uma reserva que nunca foi enviada. Não existe nada na JUDIT, então
// não há histórico a preservar.
export async function discardReservation(id: string): Promise<boolean> {
  const { trackings } = collections(await getDb());
  const result = await trackings.deleteOne({ _id: id, ...pendingReservation });
  return result.deletedCount === 1;
}

// Registra o estado mais recente informado pela JUDIT para um monitoramento
// já confirmado.
export async function applyRemoteTracking(
  id: string,
  remote: RemoteTrackingFields,
): Promise<Tracking | null> {
  const { trackings } = collections(await getDb());
  const now = new Date();
  const doc = await trackings.findOneAndUpdate(
    { _id: id, creation: "confirmed" },
    {
      $set: {
        ...remoteFields(remote),
        active: activeFor(remote.status, "confirmed"),
        lastCheckedAt: now,
        updatedAt: now,
      },
    },
    { returnDocument: "after" },
  );
  return doc ? toTracking(doc) : null;
}

function remoteFields(remote: RemoteTrackingFields) {
  return {
    status: remote.status,
    ...(remote.recurrenceDays !== undefined
      ? { recurrenceDays: remote.recurrenceDays }
      : {}),
    ...(remote.hourRange !== undefined ? { hourRange: remote.hourRange } : {}),
  };
}

// Por padrão, só sai de "sending": quem chama acabou de reivindicar a
// reserva. A conferência de um envio incerto passa `from` explicitamente.
async function setCreation(
  id: string,
  creation: TrackingCreation,
  creationError: string | null,
  extra: Partial<TrackingDoc> = {},
  from: TrackingCreation[] = ["sending"],
): Promise<Tracking | null> {
  const { trackings } = collections(await getDb());
  const now = new Date();
  const status = extra.status ?? null;
  const doc = await trackings.findOneAndUpdate(
    { _id: id, creation: { $in: from } },
    {
      $set: {
        ...extra,
        creation,
        creationError,
        active: activeFor(status, creation),
        lastCheckedAt: creation === "confirmed" ? now : null,
        updatedAt: now,
      },
    },
    { returnDocument: "after" },
  );
  return doc ? toTracking(doc) : null;
}
