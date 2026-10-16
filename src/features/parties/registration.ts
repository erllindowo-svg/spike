import type { EntitiesResponse } from "@/lib/judit/schemas/lawsuits";

import { normalizeCnpj } from "./cnpj";

// Converte a resposta de POST /entities (dados cadastrais) nos campos que a
// empresa guarda. Função pura: não chama a rede nem o banco.
// https://docs.judit.io/registration-data/registration-data

export type RegistrationData = {
  // A JUDIT devolveu um cadastro para o CNPJ.
  found: boolean;
  // Razão social (`name`).
  name: string | null;
  // Situação na Receita Federal.
  registrationStatus: string | null;
};

type Entity = EntitiesResponse["response_data"][number];

export function fromJuditEntities(
  response: EntitiesResponse,
  document: string,
): RegistrationData {
  const entity = pickEntity(response.response_data, document);
  if (!entity) {
    return { found: false, name: null, registrationStatus: null };
  }
  return {
    found: true,
    name: text(entity.name),
    registrationStatus: registrationStatus(entity),
  };
}

// A resposta é uma lista. Preferimos o cadastro cujo documento é o pedido
// (CNPJ ou CPF); sem ele, o primeiro da lista. A documentação não diz quando
// a lista teria mais de um item para uma busca por documento.
// normalizeCnpj serve aos dois: tira a máscara e deixa letras e dígitos.
function pickEntity(entities: Entity[], document: string): Entity | null {
  const target = normalizeCnpj(document);
  return (
    entities.find(
      (e) =>
        typeof e.main_document === "string" &&
        normalizeCnpj(e.main_document) === target,
    ) ??
    entities[0] ??
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
