"use server";

import { z } from "zod";

import type { QuerySearchType, SearchType } from "@/lib/models";
import { isDocumentType } from "@/features/parties/documents";
import type { RegistrationData } from "@/features/parties/registration";
import {
  summarizeDistribution,
  type Lawsuit,
} from "@/features/processes/types";
import { getLawsuitByCnj, getPartyByDocument, listLawsuits } from "@/lib/data";

import {
  ASYNC_CONSULT_FEATURES,
  consultFeature,
  CONSULT_FEATURE_IDS,
  type ConsultFeatureId,
} from "./catalog";
import { parseSearchKey } from "./identify";
import type { ConsultPayload } from "./results";

// Server Action da página Consultar: uma consulta avulsa, escolhida no
// catálogo (catalog.ts). No protótipo, as respostas vêm dos dados fictícios
// (src/lib/data.ts): a tela é a do app real, e o resultado diz que é
// fictício. Nada é enviado à JUDIT. Modo, tipo e chave são validados de
// novo, como no app real: nada aqui confia no navegador.

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
  | { ok: true; demo: true; payload: ConsultPayload }
  | { ok: false; reason: "unavailable" | "invalid" | "error"; message: string };

type ParsedQuery = {
  feature: ConsultFeatureId;
  searchType: SearchType;
  searchKey: string;
  aiSummary?: boolean;
};

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
  return demoConsult(parsed.data);
}

// As respostas, montadas com os dados fictícios.
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
