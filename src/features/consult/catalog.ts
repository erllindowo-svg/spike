import type { QueryMode, QuerySearchType } from "@/db/models";
import { QUERY_MODES } from "@/features/queries/modes";

// Catálogo das consultas avulsas da página Consultar (círculo 2 do escopo;
// mapa completo em docs/mapa-funcionalidades-judit.md). Cada consulta diz o
// que aceita como identificador; a tela mostra só as que servem ao que foi
// digitado. Os textos vêm de QUERY_MODES, para não repetir a descrição.

export type ConsultFeatureId =
  | "count"
  | "synthetic"
  | "lawsuits"
  | "registration"
  | "registration_on_demand"
  | "history_async"
  | "lawsuit_datalake"
  | "lawsuit_on_demand";

export type ConsultFeature = {
  id: ConsultFeatureId;
  mode: QueryMode;
  searchTypes: readonly QuerySearchType[];
};

// Na ordem em que fazem sentido: o raio-x rápido (contagem, resumo) antes da
// lista, que pode ser enorme (escolha S4 do escopo).
export const CONSULT_FEATURES: readonly ConsultFeature[] = [
  { id: "count", mode: "datalake_count", searchTypes: ["cnpj", "cpf"] },
  { id: "synthetic", mode: "datalake_synthetic", searchTypes: ["cnpj", "cpf"] },
  { id: "lawsuits", mode: "datalake_sync", searchTypes: ["cnpj", "cpf"] },
  {
    id: "registration",
    mode: "registration_data",
    searchTypes: ["cnpj", "cpf"],
  },
  {
    id: "registration_on_demand",
    mode: "registration_on_demand",
    searchTypes: ["cnpj", "cpf"],
  },
  {
    id: "history_async",
    mode: "historical_async",
    searchTypes: ["cnpj", "cpf"],
  },
  { id: "lawsuit_datalake", mode: "lawsuit_datalake", searchTypes: ["cnj"] },
  { id: "lawsuit_on_demand", mode: "lawsuit_on_demand", searchTypes: ["cnj"] },
];

export const CONSULT_FEATURE_IDS = CONSULT_FEATURES.map((f) => f.id) as [
  ConsultFeatureId,
  ...ConsultFeatureId[],
];

export function featuresFor(type: QuerySearchType): ConsultFeature[] {
  return CONSULT_FEATURES.filter((f) => f.searchTypes.includes(type));
}

export function consultFeature(id: ConsultFeatureId): ConsultFeature {
  return CONSULT_FEATURES.find((f) => f.id === id)!;
}

export function featureInfo(id: ConsultFeatureId) {
  return QUERY_MODES[consultFeature(id).mode];
}
