import type { EntitiesResponse } from "@/lib/judit/schemas/lawsuits";

import { normalizeCnpj } from "./cnpj";

// Converte a resposta de POST /entities (dados cadastrais) nos campos que a
// empresa guarda. Função pura: não chama a rede nem o banco.
// https://docs.judit.io/registration-data/registration-data

export type RegistrationData = {
  // A JUDIT devolveu um cadastro para o CNPJ.
  found: boolean;
  // Razão social (`name`).
  legalName: string | null;
  // Situação na Receita Federal.
  registrationStatus: string | null;
};

type Entity = EntitiesResponse["response_data"][number];

export function fromJuditEntities(
  response: EntitiesResponse,
  cnpj: string,
): RegistrationData {
  const entity = pickEntity(response.response_data, cnpj);
  if (!entity) {
    return { found: false, legalName: null, registrationStatus: null };
  }
  return {
    found: true,
    legalName: text(entity.name),
    registrationStatus: registrationStatus(entity),
  };
}

// A resposta é uma lista. Preferimos o cadastro cujo documento é o CNPJ
// pedido; sem ele, o primeiro cadastro de empresa. A documentação não diz
// quando a lista teria mais de um item para uma busca por CNPJ.
function pickEntity(entities: Entity[], cnpj: string): Entity | null {
  const target = normalizeCnpj(cnpj);
  return (
    entities.find(
      (e) =>
        typeof e.main_document === "string" &&
        normalizeCnpj(e.main_document) === target,
    ) ??
    entities.find((e) => e.entity_type === "company") ??
    null
  );
}

// `revenue_service_status` (texto) aparece no OpenAPI; os exemplos da página
// só trazem `revenue_service_active` (sim ou não). Usamos o texto quando
// vier e, sem ele, traduzimos o sim ou não.
function registrationStatus(entity: Entity): string | null {
  const status = text(entity.revenue_service_status);
  if (status) return status;
  if (entity.revenue_service_active === true) return "Ativa";
  if (entity.revenue_service_active === false) return "Inativa";
  return null;
}

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}
