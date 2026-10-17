"use server";

import { z } from "zod";

import type { QuerySearchType, SearchType, SyncQueryMode } from "@/db/models";
import { ensureParty, updatePartyRegistration } from "@/features/parties/db";
import { isDocumentType } from "@/features/parties/documents";
import {
  fromJuditEntities,
  type RegistrationData,
} from "@/features/parties/registration";
import { formatCnj } from "@/features/processes/cnj";
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
  ASYNC_CONSULT_FEATURES,
  consultFeature,
  CONSULT_FEATURE_IDS,
  type ConsultFeatureId,
} from "./catalog";
import { saveBatch, saveQuietly, saveStats } from "@/features/base/db";
import {
  lawsuitRecord,
  registrationRecords,
  type BaseBatch,
  type StatsRecord,
} from "@/features/base/records";

import { parseSearchKey } from "./identify";
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
    searchType: z.enum(["cnpj", "cpf", "cnj", "oab", "name", "rji"]),
    searchKey: z.string(),
    // Só na consulta processual completa (lawsuit_async).
    aiSummary: z.boolean().optional(),
  })
  .transform((value, ctx) => {
    if (!consultFeature(value.feature).searchTypes.includes(value.searchType)) {
      ctx.addIssue({
        code: "custom",
        message: "Esta consulta não aceita esse tipo de identificador.",
      });
      return z.NEVER;
    }
    // A mesma regra de reconhecimento da tela (identify.ts).
    const searchKey = parseSearchKey(value.searchType, value.searchKey);
    if (!searchKey) {
      ctx.addIssue({ code: "custom", message: "Identificador inválido." });
      return z.NEVER;
    }
    return { ...value, searchKey };
  });

export type ConsultInput = {
  feature: ConsultFeatureId;
  searchType: QuerySearchType;
  searchKey: string;
  aiSummary?: boolean;
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

  if (ASYNC_CONSULT_FEATURES.includes(query.feature)) {
    return startAsync(query);
  }

  try {
    await assertDailyBudget();
    const party = isDocumentType(query.searchType)
      ? await getPartyByDocument(query.searchType, query.searchKey)
      : null;
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
    // Base própria (D1): tudo o que veio, no nosso formato. Uma falha aqui
    // não esconde o resultado, que já foi cobrado.
    const subject = {
      searchType: query.searchType,
      searchKey: query.searchKey,
    };
    const source = {
      origin: "sync" as const,
      mode,
      reference: outcome.requestId,
    };
    await saveQuietly(
      `${mode}, request_id ${outcome.requestId ?? "-"}`,
      async () => {
        if (outcome.batch) await saveBatch(subject, source, outcome.batch);
        if (outcome.stats) await saveStats(subject, source, outcome.stats);
      },
    );
    return { ok: true, demo: false, payload: outcome.payload };
  } catch (error) {
    return juditActionFailure(error, "consult");
  }
}

type ParsedQuery = {
  feature: ConsultFeatureId;
  searchType: SearchType;
  searchKey: string;
  aiSummary?: boolean;
};

// O `search_type` da JUDIT para cada tipo do app nas consultas por parte
// (CNJ tem as suas próprias consultas, abaixo).
type JuditDocumentSearchType = "cpf" | "cnpj" | "oab" | "name";

function documentSearch(query: ParsedQuery): {
  searchType: JuditDocumentSearchType;
  searchKey: string;
} {
  const { searchType } = query;
  if (searchType === "cnj" || searchType === "rji") {
    throw new Error(`Tipo ${searchType} não é aceito nesta consulta.`);
  }
  return { searchType, searchKey: query.searchKey };
}

// Uma chamada à JUDIT por consulta. Documentos vão sem máscara, como nas
// outras consultas; o CNJ vai formatado, como nos exemplos da documentação;
// a OAB vai como número + UF (README da integração, item 47); o nome, como
// foi digitado, sem espaços sobrando.
async function callJudit(
  query: ParsedQuery,
  party: { id: string; document: string } | null,
): Promise<{
  payload: ConsultPayload;
  requestId: string | null;
  resultCount: number | null;
  // O que vai para a base própria.
  batch?: BaseBatch;
  stats?: StatsRecord;
}> {
  const subject = { searchType: query.searchType, searchKey: query.searchKey };
  const lawsuitsBatch = (items: Parameters<typeof lawsuitRecord>[0][]) => ({
    records: items.map((item) => lawsuitRecord(item, "lawsuit", subject)),
    aiSummary: null,
  });

  switch (query.feature) {
    case "count": {
      const result = await countLawsuits(documentSearch(query));
      return {
        payload: { kind: "count", total: result.total },
        requestId: null,
        resultCount: result.total,
        stats: {
          mode: "datalake_count",
          total: result.total,
          groups: [],
          juditData: result,
        },
      };
    }
    case "synthetic": {
      const result = await getLawsuitsSynthetic(documentSearch(query));
      const groups = syntheticGroups(result);
      return {
        payload: {
          kind: "synthetic",
          total: result.lawsuits_count ?? null,
          groups,
        },
        requestId: result.request_id ?? null,
        resultCount: result.lawsuits_count ?? null,
        stats: {
          mode: "datalake_synthetic",
          total: result.lawsuits_count ?? null,
          groups,
          juditData: result,
        },
      };
    }
    case "lawsuits": {
      const result = await searchLawsuits(documentSearch(query));
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
        // Todos os processos, inclusive os que passam do limite da tela.
        batch: lawsuitsBatch(result.lawsuits),
      };
    }
    case "registration":
    case "registration_on_demand": {
      const { searchType, searchKey } = documentSearch(query);
      if (searchType === "oab") {
        throw new Error("Dados cadastrais não aceitam OAB.");
      }
      const result = await getEntity({
        searchType,
        searchKey,
        // Receita em tempo real: mais cara e mais lenta.
        onDemand: query.feature === "registration_on_demand",
      });
      // Por nome, a JUDIT pode devolver mais de um cadastro; a tela mostra o
      // primeiro (o desenho da base própria, fatia 5, guarda todos).
      const registration = fromJuditEntities(result, searchKey);
      // A parte salva fica com os dados novos; uma parte não salva continua
      // fora da lista (a consulta é avulsa).
      if (party && registration.found) {
        await updatePartyRegistration(party.id, registration);
      }
      return {
        payload: { kind: "registration", registration },
        requestId: result.request_id ?? null,
        resultCount: result.response_data.length,
        // Todos os cadastros da lista, com endereços, contatos e sócios no
        // `juditData` (D1: gravar tudo).
        batch: {
          records: registrationRecords(result.response_data),
          aiSummary: null,
        },
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
          batch: lawsuitsBatch([item]),
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
        batch: lawsuitsBatch(result.lawsuits),
      };
    }
    case "history_async":
    case "history_on_demand":
    case "lawsuit_async":
    case "warrants":
    case "criminal_execution":
      throw new Error("Consulta assíncrona não passa por callJudit.");
  }
}

// As consultas assíncronas são acompanhadas depois, na ficha do assunto
// (Minhas informações). As por CPF ou CNPJ salvam a parte antes, sem
// consultar dados cadastrais, porque a action as liga a ela; as por CNJ,
// OAB, nome ou RJI não têm parte. O resto é a mesma action de sempre (teto
// diário, consulta igual em aberto, webhook).
async function startAsync(query: ParsedQuery): Promise<ConsultResult> {
  const mode =
    query.feature === "warrants"
      ? "warrant"
      : query.feature === "criminal_execution"
        ? "criminal_execution"
        : query.feature === "history_on_demand"
          ? "historical_on_demand"
          : "historical_async";
  let result;
  if (query.feature === "lawsuit_async") {
    result = await startAsyncQueryAction({
      mode: "lawsuit_async",
      cnj: query.searchKey,
      aiSummary: query.aiSummary,
    });
  } else if (!isDocumentType(query.searchType)) {
    // O catálogo só oferece a on-demand para CPF e CNPJ; a action recusa o
    // resto de novo.
    if (mode === "historical_on_demand") {
      return {
        ok: false,
        reason: "invalid",
        message: "Esta consulta não aceita esse tipo de identificador.",
      };
    }
    result = await startAsyncQueryAction({
      mode,
      searchType: query.searchType,
      searchKey: query.searchKey,
    });
  } else {
    const documentType = query.searchType;
    try {
      await ensureParty(documentType, query.searchKey);
    } catch (error) {
      return juditActionFailure(error, "consult");
    }
    result = await startAsyncQueryAction({
      mode,
      documentType,
      document: query.searchKey,
    });
  }
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

  if (ASYNC_CONSULT_FEATURES.includes(query.feature)) {
    return {
      ok: false,
      reason: "unavailable",
      message:
        "Na demonstração, as consultas assíncronas não existem: elas são criadas na JUDIT e acompanhadas depois.",
    };
  }

  if (query.searchType === "cnj") {
    const lawsuit = await getLawsuitByCnj(query.searchKey);
    return demo({ kind: "lawsuit", lawsuits: lawsuit ? [lawsuit] : [] });
  }
  // Os dados fictícios só têm empresas, pessoas e processos.
  if (!isDocumentType(query.searchType)) {
    return {
      ok: false,
      reason: "unavailable",
      message: "Busca por OAB, nome ou RJI indisponível na demonstração.",
    };
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
        message: "Consulta não disponível na demonstração.",
      };
  }
}
