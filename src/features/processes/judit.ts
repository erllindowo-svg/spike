import { normalizeCnpj } from "@/features/companies/cnpj";
import type { Lawsuit as JuditLawsuit } from "@/lib/judit/schemas/lawsuits";

import { normalizeCnj } from "./cnj";
import type { CompanyRole, Lawsuit, LawsuitStatus } from "./types";

// Converte um processo do datalake da JUDIT (POST /lawsuits) no modelo de
// exibição da aplicação. Função pura: não chama a rede nem o banco.
//
// O schema só garante `code`. O resto é lido com cuidado porque a
// documentação se contradiz no formato (README da integração, contradições
// 16, 33 e 34): `classifications` aparece como lista de textos ou de objetos
// `{ code, name }`, `side` como "ACTIVE" ou "Active", e vários campos chegam
// com o texto "NÃO INFORMADO" em vez de ficarem ausentes.

export function fromJuditLawsuit(
  item: JuditLawsuit,
  // Empresa do CNPJ consultado. Sem empresa (monitoramento por CNJ), o
  // processo fica sem empresa e sem lado.
  company: { id: string; cnpj: string } | null,
): Lawsuit {
  const cnj = normalizeCnj(item.code);
  return {
    id: `${cnj}-${item.instance ?? 1}`,
    cnj,
    companyId: company?.id ?? null,
    tribunal: text(item.tribunal_acronym) ?? "Não informado",
    area: text(item.area),
    className: firstName(item.classifications),
    subject: firstName(item.subjects),
    judgingBody: firstName(item.courts) ?? text(item.county),
    companyRole: company ? companyRole(item.parties, company.cnpj) : null,
    status: status(item.status, item.situation),
    distributedAt: date(item.distribution_date),
    lastMovementAt: date(item.last_step?.step_date),
    amount: typeof item.amount === "number" ? item.amount : null,
    // Movimentações (`steps`) ficam para outra fatia.
    movements: [],
  };
}

// "NÃO INFORMADO" é uma convenção da JUDIT para dado ausente, não um valor.
function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed === "" || trimmed.toUpperCase() === "NÃO INFORMADO") return null;
  return trimmed;
}

// Aceita um texto, uma lista de textos ou uma lista de objetos com `name`.
function firstName(value: unknown): string | null {
  const first = Array.isArray(value) ? value[0] : value;
  if (typeof first === "object" && first !== null && "name" in first) {
    return text(first.name);
  }
  return text(first);
}

function date(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

const sides: Record<string, CompanyRole> = {
  ACTIVE: "active",
  PASSIVE: "passive",
  INTERESTED: "interested",
};

// Lado da empresa: a parte cujo documento é o CNPJ consultado. Sem
// documento correspondente, o lado fica desconhecido (não adivinhamos pelo
// nome, que pode ser homônimo).
function companyRole(parties: unknown, cnpj: string): CompanyRole | null {
  if (!Array.isArray(parties)) return null;
  const target = normalizeCnpj(cnpj);
  for (const party of parties) {
    if (typeof party !== "object" || party === null) continue;
    const documents = [
      "main_document" in party ? party.main_document : undefined,
      ...("documents" in party && Array.isArray(party.documents)
        ? party.documents.map((d: unknown) =>
            typeof d === "object" && d !== null && "document" in d
              ? d.document
              : undefined,
          )
        : []),
    ];
    const matches = documents.some(
      (doc) => typeof doc === "string" && normalizeCnpj(doc) === target,
    );
    if (matches && "side" in party && typeof party.side === "string") {
      return sides[party.side.toUpperCase()] ?? null;
    }
  }
  return null;
}

// Só os valores documentados que têm equivalente claro na interface
// (https://docs.judit.io/schemas/lawsuit-enums). "FINALIZADO" e as demais
// situações ficam sem status, em vez de forçar um rótulo parecido.
function status(
  globalStatus: unknown,
  situation: unknown,
): LawsuitStatus | null {
  const s = text(situation)?.toUpperCase();
  if (s === "ARQUIVADO") return "archived";
  if (s === "SUSPENSO") return "suspended";
  if (text(globalStatus)?.toUpperCase() === "ATIVO") return "active";
  return null;
}
