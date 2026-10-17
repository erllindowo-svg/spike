import type { EntitiesResponse } from "@/lib/judit/schemas/lawsuits";

import { normalizeCnpj } from "./cnpj";

// Converte a resposta de POST /entities (dados cadastrais) nos campos que a
// parte guarda (nome e situação) e em dois que só aparecem na tela (nome
// fantasia e situação especial). Função pura: não chama a rede nem o banco.
// https://docs.judit.io/registration-data/registration-data

export type RegistrationData = {
  // A JUDIT devolveu um cadastro para o documento.
  found: boolean;
  // Razão social ou nome (`name`).
  name: string | null;
  // Situação na Receita Federal.
  registrationStatus: string | null;
  // Nome fantasia (`social_name`), só de empresas.
  tradeName: string | null;
  // Ex.: "RECUPERACAO JUDICIAL" (`special_status`).
  specialStatus: string | null;
};

export type Entity = EntitiesResponse["response_data"][number];

export function fromJuditEntities(
  response: EntitiesResponse,
  document: string,
): RegistrationData {
  const entity = pickEntity(response.response_data, document);
  if (!entity) {
    return {
      found: false,
      name: null,
      registrationStatus: null,
      tradeName: null,
      specialStatus: null,
    };
  }
  return fromJuditEntity(entity);
}

// Um cadastro da lista, nos campos do app. Também usado pela base própria
// (src/features/base/records.ts), que grava todos os cadastros da lista.
export function fromJuditEntity(entity: Entity): RegistrationData {
  return {
    found: true,
    name: text(entity.name),
    registrationStatus: registrationStatus(entity),
    tradeName: text(entity.social_name),
    specialStatus: text(entity.special_status),
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
