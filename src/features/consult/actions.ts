"use server";

import { z } from "zod";

import type { QuerySearchType, SyncQueryMode } from "@/db/models";
import { ensureParty, updatePartyRegistration } from "@/features/parties/db";
import {
  documentSchema,
  type DocumentType,
} from "@/features/parties/documents";
import {
  fromJuditEntities,
  type RegistrationData,
} from "@/features/parties/registration";
import { cnjSchema, formatCnj } from "@/features/processes/cnj";
import { fromJuditLawsuit } from "@/features/processes/judit";
import {
  summarizeDistribution,
  type Lawsuit,
} from "@/features/processes/types";
import { startAsyncQueryAction } from "@/features/queries/actions";
import { assertDailyBudget } from "@/features/queries/budget";
import {
  juditActionFailure,
  type JuditActionFailure,
} from "@/features/queries/failure";
import { logSyncQuery, syncFailureFor } from "@/features/queries/sync-log";
import {
  getDataSource,
  getLawsuitByCnj,
  getPartyByDocument,
  listLawsuits,
} from "@/lib/data";
import { JuditHttpError } from "@/lib/judit/errors";
import {
  countLawsuits,
  getEntity,
  getLawsuitByCnj as fetchLawsuitByCnj,
  getLawsuitsSynthetic,
  searchLawsuits,
} from "@/lib/judit/lawsuits";

import {
  consultFeature,
  CONSULT_FEATURE_IDS,
  type ConsultFeatureId,
} from "./catalog";
import { syntheticGroups, type ConsultPayload } from "./results";

// Server Action da página Consultar: uma consulta avulsa, escolhida no
// catálogo (catalog.ts), sem salvar a parte nem criar monitoramento. A
// exceção é o histórico assíncrono, que precisa da parte salva para ser
// acompanhado depois (o status é verificado na página dela).
//
// Como as outras actions cobradas, nada aqui confia no navegador: modo, tipo
// e chave validados de novo, teto diário e as proteções do client. Cada
// chamada que chega à JUDIT entra no histórico (sync_queries), só com
// metadados.
//
// Na demonstração, as respostas vêm dos dados fictícios (src/lib/data.ts):
// a tela é a mesma, e o resultado diz que é fictício.

const MAX_LAWSUITS_ON_SCREEN = 500;

const inputSchema = z
  .object({
    feature: z.enum(CONSULT_FEATURE_IDS),
    searchType: z.enum(["cnpj", "cpf", "cnj"]),
    searchKey: z.string(),
  })
  .transform((value, ctx) => {
    if (!consultFeature(value.feature).searchTypes.includes(value.searchType)) {
      ctx.addIssue({
        code: "custom",
        message: "Esta consulta não aceita esse tipo de identificador.",
      });
      return z.NEVER;
    }
    const parsed = (
      value.searchType === "cnj" ? cnjSchema : documentSchema(value.searchType)
    ).safeParse(value.searchKey);
    if (!parsed.success) {
      ctx.addIssue({
        code: "custom",
        message: parsed.error.issues[0]?.message ?? "Identificador inválido.",
      });
      return z.NEVER;
    }
    return { ...value, searchKey: parsed.data };
  });

export type ConsultInput = {
  feature: ConsultFeatureId;
  searchType: QuerySearchType;
  searchKey: string;
};

export type ConsultResult =
  | {
      ok: true;
      // Resultado montado com os dados fictícios da demonstração.
      demo: boolean;
      payload: ConsultPayload;
    }
  | { ok: false; reason: "unavailable" | "invalid"; message: string }
  | JuditActionFailure;

export async function runConsultAction(
  input: ConsultInput,
): Promise<ConsultResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      reason: "invalid",
      message: parsed.error.issues[0]?.message ?? "Dados inválidos.",
    };
  }
  const query = parsed.data;

  if (getDataSource() !== "db") return demoConsult(query);

  if (query.feature === "history_async") {
    return startHistory(query.searchType as DocumentType, query.searchKey);
  }

  try {
    await assertDailyBudget();
    const party =
      query.searchType === "cnj"
        ? null
        : await getPartyByDocument(query.searchType, query.searchKey);
    const mode = consultFeature(query.feature).mode as SyncQueryMode;
    const base = {
      mode,
      partyId: party?.id ?? null,
      searchType: query.searchType,
      searchKey: query.searchKey,
    };

    let outcome: Awaited<ReturnType<typeof callJudit>>;
    try {
      outcome = await callJudit(query, party);
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
      requestId: outcome.requestId,
      outcome: "ok",
      resultCount: outcome.resultCount,
      errorKind: null,
    });
    return { ok: true, demo: false, payload: outcome.payload };
  } catch (error) {
    return juditActionFailure(error, "consult");
  }
}

type ParsedQuery = {
  feature: ConsultFeatureId;
  searchType: QuerySearchType;
  searchKey: string;
};

// Uma chamada à JUDIT por consulta. Documentos vão sem máscara, como nas
// outras consultas; o CNJ vai formatado, como nos exemplos da documentação.
async function callJudit(
  query: ParsedQuery,
  party: { id: string; document: string } | null,
): Promise<{
  payload: ConsultPayload;
  requestId: string | null;
  resultCount: number | null;
}> {
  const document = {
    searchType: query.searchType as DocumentType,
    searchKey: query.searchKey,
  };

  switch (query.feature) {
    case "count": {
      const result = await countLawsuits(document);
      return {
        payload: { kind: "count", total: result.total },
        requestId: null,
        resultCount: result.total,
      };
    }
    case "synthetic": {
      const result = await getLawsuitsSynthetic(document);
      return {
        payload: {
          kind: "synthetic",
          total: result.lawsuits_count ?? null,
          groups: syntheticGroups(result),
        },
        requestId: result.request_id ?? null,
        resultCount: result.lawsuits_count ?? null,
      };
    }
    case "lawsuits": {
      const result = await searchLawsuits(document);
      return {
        payload: {
          kind: "lawsuits",
          lawsuits: result.lawsuits
            .slice(0, MAX_LAWSUITS_ON_SCREEN)
            .map((item) => fromJuditLawsuit(item, party)),
          total: result.lawsuits.length,
        },
        requestId: result.request_id ?? null,
        resultCount: result.lawsuits.length,
      };
    }
    case "registration":
    case "registration_on_demand": {
      const result = await getEntity({
        searchType: query.searchType as DocumentType,
        searchKey: query.searchKey,
        // Receita em tempo real: mais cara e mais lenta.
        onDemand: query.feature === "registration_on_demand",
      });
      const registration = fromJuditEntities(result, query.searchKey);
      // A parte salva fica com os dados novos; uma parte não salva continua
      // fora da lista (a consulta é avulsa).
      if (party && registration.found) {
        await updatePartyRegistration(party.id, registration);
      }
      return {
        payload: { kind: "registration", registration },
        requestId: result.request_id ?? null,
        resultCount: result.response_data.length,
      };
    }
    case "lawsuit_datalake": {
      // 404: o CNJ não está na base da JUDIT (docs/resource/errors). Não
      // encontrar é um resultado, não uma falha.
      try {
        const item = await fetchLawsuitByCnj({
          cnj: formatCnj(query.searchKey),
        });
        return {
          payload: {
            kind: "lawsuit",
            lawsuits: [fromJuditLawsuit(item, null)],
          },
          requestId: null,
          resultCount: 1,
        };
      } catch (error) {
        if (error instanceof JuditHttpError && error.status === 404) {
          return {
            payload: { kind: "lawsuit", lawsuits: [] },
            requestId: null,
            resultCount: 0,
          };
        }
        throw error;
      }
    }
    case "lawsuit_on_demand": {
      const result = await searchLawsuits({
        searchType: "lawsuit_cnj",
        searchKey: formatCnj(query.searchKey),
        onDemand: true,
      });
      return {
        payload: {
          kind: "lawsuit",
          lawsuits: result.lawsuits.map((item) => fromJuditLawsuit(item, null)),
        },
        requestId: result.request_id ?? null,
        resultCount: result.lawsuits.length,
      };
    }
    case "history_async":
      throw new Error("Consulta assíncrona não passa por callJudit.");
  }
}

// O histórico assíncrono é acompanhado na página da parte, então a parte é
// salva antes (sem consultar dados cadastrais). O resto é a mesma action do
// card da empresa (teto diário, consulta igual em aberto, webhook).
async function startHistory(
  documentType: DocumentType,
  document: string,
): Promise<ConsultResult> {
  try {
    await ensureParty(documentType, document);
  } catch (error) {
    return juditActionFailure(error, "consult");
  }
  const result = await startAsyncQueryAction({
    mode: "historical_async",
    documentType,
    document,
  });
  if (!result.ok) return result;
  return {
    ok: true,
    demo: false,
    payload: { kind: "async", requestId: result.request.requestId },
  };
}

// Demonstração: as mesmas respostas, montadas com os dados fictícios.
async function demoConsult(query: ParsedQuery): Promise<ConsultResult> {
  const demo = (payload: ConsultPayload): ConsultResult => ({
    ok: true,
    demo: true,
    payload,
  });

  if (query.searchType === "cnj") {
    const lawsuit = await getLawsuitByCnj(query.searchKey);
    return demo({ kind: "lawsuit", lawsuits: lawsuit ? [lawsuit] : [] });
  }

  const party = await getPartyByDocument(query.searchType, query.searchKey);
  const lawsuits: Lawsuit[] = party
    ? await listLawsuits({ partyId: party.id })
    : [];

  switch (query.feature) {
    case "count":
      return demo({ kind: "count", total: lawsuits.length });
    case "synthetic":
      return demo({
        kind: "synthetic",
        total: lawsuits.length,
        groups: [
          {
            title: "Tribunal",
            data: summarizeDistribution(lawsuits, "tribunal"),
          },
          { title: "Área", data: summarizeDistribution(lawsuits, "area") },
        ].filter((group) => group.data.length > 0),
      });
    case "lawsuits":
      return demo({ kind: "lawsuits", lawsuits, total: lawsuits.length });
    case "registration":
    case "registration_on_demand": {
      const registration: RegistrationData = party
        ? {
            found: true,
            name: party.name,
            registrationStatus: party.registrationStatus,
            tradeName: null,
            specialStatus: null,
          }
        : {
            found: false,
            name: null,
            registrationStatus: null,
            tradeName: null,
            specialStatus: null,
          };
      return demo({ kind: "registration", registration });
    }
    default:
      return {
        ok: false,
        reason: "unavailable",
        message:
          "Na demonstração, a consulta assíncrona não existe: ela é criada na JUDIT e acompanhada depois.",
      };
  }
}
