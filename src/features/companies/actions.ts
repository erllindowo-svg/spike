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
import { getEntity } from "@/lib/judit/lawsuits";

import { cnpjSchema } from "./cnpj";
import {
  ensureCompany,
  getCompanyByCnpj,
  updateCompanyRegistration,
} from "./db";
import { fromJuditEntities, type RegistrationData } from "./registration";

// Server Actions de empresas (círculo 1 do escopo, docs/etapa-7-escopo.md):
//
//   addCompanyAction                 salva um CNPJ na lista. Com `lookup`,
//                                    consulta antes os dados cadastrais
//                                    (POST /entities, cobrada); se a JUDIT
//                                    recusar, nada é salvo.
//   refreshRegistrationDataAction    consulta de novo os dados cadastrais de
//                                    uma empresa já salva.
//
// Como as outras actions que chamam a JUDIT, nada aqui confia no navegador:
// modo "db", CNPJ validado de novo, kill switch e allowlist do client.

type Unavailable = {
  ok: false;
  reason: "unavailable" | "invalid";
  message: string;
};

const addInputSchema = z.object({ cnpj: cnpjSchema, lookup: z.boolean() });

export type AddCompanyResult =
  | {
      ok: true;
      cnpj: string;
      // Nulo quando a empresa foi salva sem consultar.
      registration: RegistrationData | null;
    }
  | Unavailable
  | JuditActionFailure;

export async function addCompanyAction(input: {
  cnpj: string;
  lookup: boolean;
}): Promise<AddCompanyResult> {
  if (getDataSource() !== "db") return unavailable();

  const parsed = addInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, reason: "invalid", message: "CNPJ inválido." };
  }
  const { cnpj, lookup } = parsed.data;

  try {
    // Consulta primeiro: se a JUDIT recusar (ou a allowlist barrar), a
    // empresa não é salva, e a pessoa decide se salva sem os dados.
    const registration = lookup ? await lookupRegistration(cnpj, null) : null;
    const company = await ensureCompany(cnpj);
    if (registration?.found) {
      await updateCompanyRegistration(company.id, registration);
    }
    refresh();
    return { ok: true, cnpj: company.cnpj, registration };
  } catch (error) {
    return juditActionFailure(error, "companies");
  }
}

export type RefreshRegistrationResult =
  | { ok: true; registration: RegistrationData }
  | Unavailable
  | JuditActionFailure;

export async function refreshRegistrationDataAction(
  cnpj: string,
): Promise<RefreshRegistrationResult> {
  if (getDataSource() !== "db") return unavailable();

  const parsed = cnpjSchema.safeParse(cnpj);
  if (!parsed.success) {
    return { ok: false, reason: "invalid", message: "CNPJ inválido." };
  }

  try {
    const company = await getCompanyByCnpj(parsed.data);
    if (!company) {
      return {
        ok: false,
        reason: "invalid",
        message: "Empresa não cadastrada na aplicação.",
      };
    }
    const registration = await lookupRegistration(company.cnpj, company.id);
    if (registration.found) {
      await updateCompanyRegistration(company.id, registration);
    }
    refresh();
    return { ok: true, registration };
  } catch (error) {
    return juditActionFailure(error, "companies");
  }
}

// POST /entities com o CNPJ sem máscara, como nas consultas de processos
// (aceito pela JUDIT em POST /lawsuits e POST /requests; em /entities, ainda
// não observado). Registra a chamada no histórico da página Consultas.
async function lookupRegistration(
  cnpj: string,
  companyId: string | null,
): Promise<RegistrationData> {
  const base = {
    mode: "registration_data",
    companyId,
    searchType: "cnpj",
    searchKey: cnpj,
  } as const;

  await assertDailyBudget();

  let response;
  try {
    response = await getEntity({ searchType: "cnpj", searchKey: cnpj });
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
  return fromJuditEntities(response, cnpj);
}

function unavailable(): Unavailable {
  return {
    ok: false,
    reason: "unavailable",
    message: "Disponível só no modo banco de dados.",
  };
}
