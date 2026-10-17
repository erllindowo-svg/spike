import type { QueryMode, SearchType, TrackingMode } from "@/db/models";
import { QUERY_MODES, TRACKING_MODES } from "@/features/queries/modes";

// Catálogo das consultas da página Consultar (círculo 3, fatia 2; mapa
// completo em docs/mapa-funcionalidades-judit.md). Cada consulta diz:
//
// - os identificadores que a JUDIT aceita para ela, conferidos na página da
//   documentação em 2026-10-17 (link em `docsUrl` de QUERY_MODES). Onde a
//   JUDIT aceita mais do que o app oferece, o comentário diz o que ficou de
//   fora e por quê;
// - a pergunta que a representa para quem não conhece a API;
// - o tempo e o custo, em poucas palavras;
// - o monitoramento equivalente, se existe, e o que ele acompanha. Ele NÃO
//   devolve o mesmo dado da consulta: só avisa o que surgir depois da
//   criação (catálogo de falhas, C14).
//
// Os textos técnicos (endpoint, fontes, finalidade) continuam em QUERY_MODES.

export type ConsultFeatureId =
  | "count"
  | "synthetic"
  | "lawsuits"
  | "registration"
  | "registration_on_demand"
  | "history_async"
  | "history_on_demand"
  | "lawsuit_datalake"
  | "lawsuit_on_demand"
  | "lawsuit_async"
  | "warrants"
  | "criminal_execution";

export type ConsultTracking = {
  mode: TrackingMode;
  // Identificadores que a JUDIT monitora nesta modalidade.
  searchTypes: readonly SearchType[];
  // O que o monitoramento acompanha, numa frase.
  follows: string;
};

export type ConsultFeature = {
  id: ConsultFeatureId;
  mode: QueryMode;
  searchTypes: readonly SearchType[];
  question: string;
  // Tempo esperado e custo, para a escolha (ex.: "Na hora · cobrada").
  timing: string;
  tracking: ConsultTracking | null;
};

// https://docs.judit.io/tracking/tracking-document: `search_type` cpf, cnpj
// ou oab. Avisa processos distribuídos depois da criação.
const DOCUMENT_TRACKING: ConsultTracking = {
  mode: "tracking_document",
  searchTypes: ["cpf", "cnpj", "oab"],
  follows: "Processos novos, distribuídos depois que o monitoramento começar.",
};

// https://docs.judit.io/tracking/tracking: só lawsuit_cnj.
const LAWSUIT_TRACKING: ConsultTracking = {
  mode: "tracking_lawsuit",
  searchTypes: ["cnj"],
  follows: "Movimentações novas deste processo.",
};

const SYNC = "Na hora · cobrada por consulta";
const ASYNC = "Minutos; o resultado chega depois · cobrada por consulta";

// Na ordem em que fazem sentido: o raio-x rápido (contagem, resumo) antes da
// lista, que pode ser enorme (escolha S4 do escopo).
export const CONSULT_FEATURES: readonly ConsultFeature[] = [
  {
    id: "count",
    mode: "datalake_count",
    // A JUDIT também aceita lawsuit_cnj e rji (cache-judit/count); contar os
    // processos de um processo não diz nada, e o RJI fica só nos mandados
    // (decisão D3 do círculo 3).
    searchTypes: ["cpf", "cnpj", "oab", "name"],
    question: "Quantos processos?",
    timing: SYNC,
    tracking: DOCUMENT_TRACKING,
  },
  {
    id: "synthetic",
    mode: "datalake_synthetic",
    // cache-judit/cache-grouped: cpf, cnpj, oab ou name.
    searchTypes: ["cpf", "cnpj", "oab", "name"],
    question: "Em que tribunais e áreas estão os processos?",
    timing: SYNC,
    tracking: DOCUMENT_TRACKING,
  },
  {
    id: "lawsuits",
    mode: "datalake_sync",
    // cache-judit/hotstorage: cpf, cnpj, oab ou name.
    searchTypes: ["cpf", "cnpj", "oab", "name"],
    question: "Quais são os processos?",
    timing: SYNC,
    tracking: DOCUMENT_TRACKING,
  },
  {
    id: "registration",
    mode: "registration_data",
    // registration-data: cpf, cnpj ou name.
    searchTypes: ["cpf", "cnpj", "name"],
    question: "Quais são os dados cadastrais?",
    timing: SYNC,
    tracking: null,
  },
  {
    id: "registration_on_demand",
    mode: "registration_on_demand",
    // A página não diz se o on_demand (Receita em tempo real) vale para
    // name; a Receita consulta por documento. Só CPF e CNPJ.
    searchTypes: ["cpf", "cnpj"],
    question: "Quais são os dados cadastrais, lidos agora na Receita?",
    timing: "Na hora · mais cara que a consulta cadastral comum",
    tracking: null,
  },
  {
    id: "history_async",
    mode: "historical_async",
    // requests/request-document: cpf, cnpj, oab ou name.
    searchTypes: ["cpf", "cnpj", "oab", "name"],
    question: "Qual é o histórico completo de processos?",
    timing: ASYNC,
    tracking: DOCUMENT_TRACKING,
  },
  {
    id: "history_on_demand",
    mode: "historical_on_demand",
    // Antes no card da página da parte (removida no círculo 3). Só CPF e
    // CNPJ: a consulta on-demand precisa da parte salva (startAsyncQueryAction).
    searchTypes: ["cpf", "cnpj"],
    question: "Qual é o histórico completo, buscado agora nos tribunais?",
    timing:
      "Minutos; o resultado chega depois · mais cara que a assíncrona comum",
    tracking: DOCUMENT_TRACKING,
  },
  {
    id: "lawsuit_datalake",
    mode: "lawsuit_datalake",
    searchTypes: ["cnj"],
    question: "Como está o processo na base da JUDIT?",
    timing: "Na hora · custo não informado",
    tracking: LAWSUIT_TRACKING,
  },
  {
    id: "lawsuit_on_demand",
    mode: "lawsuit_on_demand",
    searchTypes: ["cnj"],
    question: "Como está o processo agora, no tribunal?",
    timing: "Até 3 minutos · cobrada por consulta",
    tracking: LAWSUIT_TRACKING,
  },
  {
    id: "lawsuit_async",
    mode: "lawsuit_async",
    searchTypes: ["cnj"],
    question: "O processo inteiro, com partes e andamentos?",
    timing: "Minutos (mais com o resumo por IA) · cobrada por consulta",
    tracking: LAWSUIT_TRACKING,
  },
  {
    id: "warrants",
    mode: "warrant",
    // criminal-consultation/warrant: cpf, name ou rji.
    searchTypes: ["cpf", "name", "rji"],
    question: "Há mandados de prisão?",
    timing: ASYNC,
    tracking: null,
  },
  {
    id: "criminal_execution",
    mode: "criminal_execution",
    // criminal-consultation/criminal-execution: cpf, cnpj, name ou
    // lawsuit_cnj.
    searchTypes: ["cpf", "cnpj", "name", "cnj"],
    question: "Há execução penal?",
    timing: ASYNC,
    tracking: null,
  },
];

// Consultas criadas na JUDIT e acompanhadas depois (status e resultado).
export const ASYNC_CONSULT_FEATURES: readonly ConsultFeatureId[] = [
  "history_async",
  "history_on_demand",
  "lawsuit_async",
  "warrants",
  "criminal_execution",
];

export const CONSULT_FEATURE_IDS = CONSULT_FEATURES.map((f) => f.id) as [
  ConsultFeatureId,
  ...ConsultFeatureId[],
];

export function featuresFor(type: SearchType): ConsultFeature[] {
  return CONSULT_FEATURES.filter((f) => f.searchTypes.includes(type));
}

export function consultFeature(id: ConsultFeatureId): ConsultFeature {
  return CONSULT_FEATURES.find((f) => f.id === id)!;
}

export function featureInfo(id: ConsultFeatureId) {
  return QUERY_MODES[consultFeature(id).mode];
}

// O monitoramento que acompanha esta consulta para este identificador, ou
// null (dados cadastrais, mandados, execução penal, busca por nome).
export function trackingFor(
  id: ConsultFeatureId,
  type: SearchType,
): (ConsultTracking & { label: string }) | null {
  const tracking = consultFeature(id).tracking;
  if (!tracking || !tracking.searchTypes.includes(type)) return null;
  return { ...tracking, label: TRACKING_MODES[tracking.mode].label };
}

// Identificadores que alguma consulta do catálogo aceita.
export function consultableTypes(): SearchType[] {
  return [...new Set(CONSULT_FEATURES.flatMap((f) => f.searchTypes))];
}
