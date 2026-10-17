"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { assertDailyBudget } from "@/features/queries/budget";
import {
  juditActionFailure,
  type JuditActionFailure,
} from "@/features/queries/failure";
import { logSyncQuery, syncFailureFor } from "@/features/queries/sync-log";
import { getDataSource } from "@/lib/data";
import { saveBatch, saveQuietly } from "@/features/base/db";
import { registrationRecords } from "@/features/base/records";
import { getEntity } from "@/lib/judit/lawsuits";

import { ensureParty, updatePartyRegistration } from "./db";
import { partyRefSchema, type PartyRef } from "./documents";
import { fromJuditEntities, type RegistrationData } from "./registration";

// Server Actions de partes, empresas e pessoas físicas (círculos 1 e 2 do
// escopo, docs/etapa-7-escopo.md):
//
//   addPartyAction                   salva um documento na lista. Com
//                                    `lookup`, consulta antes os dados
//                                    cadastrais (POST /entities, cobrada); se
//                                    a JUDIT recusar, nada é salvo.
//
// Como as outras actions que chamam a JUDIT, nada aqui confia no navegador:
// modo "db", documento validado de novo, teto diário e as proteções do
// client.

type Unavailable = {
  ok: false;
  reason: "unavailable" | "invalid";
  message: string;
};

const addInputSchema = z.intersection(
  partyRefSchema,
  z.object({ lookup: z.boolean() }),
);

export type AddPartyResult =
  | {
      ok: true;
      party: PartyRef;
      // Nulo quando a parte foi salva sem consultar.
      registration: RegistrationData | null;
    }
  | Unavailable
  | JuditActionFailure;

export async function addPartyAction(
  input: PartyRef & { lookup: boolean },
): Promise<AddPartyResult> {
  if (getDataSource() !== "db") return unavailable();

  const parsed = addInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      reason: "invalid",
      message: parsed.error.issues[0]?.message ?? "Documento inválido.",
    };
  }
  const { documentType, document, lookup } = parsed.data;

  try {
    // Consulta primeiro: se a JUDIT recusar (ou a allowlist barrar), a parte
    // não é salva, e a pessoa decide se salva sem os dados.
    const registration = lookup
      ? await lookupRegistration({ documentType, document }, null)
      : null;
    const party = await ensureParty(documentType, document);
    if (registration?.found) {
      await updatePartyRegistration(party.id, registration);
    }
    refresh();
    return {
      ok: true,
      party: { documentType: party.documentType, document: party.document },
      registration,
    };
  } catch (error) {
    return juditActionFailure(error, "parties");
  }
}

// POST /entities com o documento sem máscara, como nas consultas de
// processos (aceito pela JUDIT em POST /lawsuits e POST /requests; em
// /entities, ainda não observado). Registra a chamada no histórico da página
// Consultas.
async function lookupRegistration(
  ref: PartyRef,
  partyId: string | null,
): Promise<RegistrationData> {
  const base = {
    mode: "registration_data",
    partyId,
    searchType: ref.documentType,
    searchKey: ref.document,
  } as const;

  await assertDailyBudget();

  let response;
  try {
    response = await getEntity({
      searchType: ref.documentType,
      searchKey: ref.document,
    });
  } catch (error) {
    const failure = syncFailureFor(error);
    if (failure) {
      await logSyncQuery({
        ...base,
        requestId: null,
        resultCount: null,
        ...failure,
      });
    }
    throw error;
  }

  await logSyncQuery({
    ...base,
    requestId: response.request_id ?? null,
    outcome: "ok",
    resultCount: response.response_data.length,
    errorKind: null,
  });
  // Base própria (D1): o cadastro inteiro, com endereços, contatos e sócios.
  await saveQuietly(
    `registration_data, request_id ${response.request_id ?? "-"}`,
    () =>
      saveBatch(
        { searchType: ref.documentType, searchKey: ref.document },
        {
          origin: "sync",
          mode: "registration_data",
          reference: response.request_id ?? null,
        },
        {
          records: registrationRecords(response.response_data),
          aiSummary: null,
        },
      ),
  );
  return fromJuditEntities(response, ref.document);
}

function unavailable(): Unavailable {
  return {
    ok: false,
    reason: "unavailable",
    message: "Disponível só no modo banco de dados.",
  };
}
