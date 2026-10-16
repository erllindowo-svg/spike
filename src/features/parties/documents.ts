import { z } from "zod";

import type { DocumentType } from "@/db/models";

import { cnpjSchema, formatCnpj, isValidCnpj, normalizeCnpj } from "./cnpj";
import { cpfSchema, formatCpf, isValidCpf, maskCpf, normalizeCpf } from "./cpf";

// O que muda entre empresa (CNPJ) e pessoa física (CPF), num lugar só. As
// telas e as actions perguntam aqui, em vez de conhecerem cada documento.

export type { DocumentType };

export const DOCUMENT_TYPES = [
  "cnpj",
  "cpf",
] as const satisfies readonly DocumentType[];

type DocumentInfo = {
  label: string;
  // Como a parte é chamada na interface.
  partyLabel: string;
  partyLabelPlural: string;
  // Rota da lista e da página da parte.
  basePath: string;
  placeholder: string;
};

export const DOCUMENTS: Record<DocumentType, DocumentInfo> = {
  cnpj: {
    label: "CNPJ",
    partyLabel: "Empresa",
    partyLabelPlural: "Empresas",
    basePath: "/empresas",
    placeholder: "00.000.000/0000-00",
  },
  cpf: {
    label: "CPF",
    partyLabel: "Pessoa física",
    partyLabelPlural: "Pessoas físicas",
    basePath: "/pessoas",
    placeholder: "000.000.000-00",
  },
};

export function normalizeDocument(type: DocumentType, value: string): string {
  return type === "cnpj" ? normalizeCnpj(value) : normalizeCpf(value);
}

export function isValidDocument(type: DocumentType, value: string): boolean {
  return type === "cnpj" ? isValidCnpj(value) : isValidCpf(value);
}

export function formatDocument(type: DocumentType, value: string): string {
  return type === "cnpj" ? formatCnpj(value) : formatCpf(value);
}

// O que aparece em listas: o CNPJ inteiro (dado público da empresa), o CPF
// mascarado (dado pessoal).
export function displayDocument(type: DocumentType, value: string): string {
  return type === "cnpj" ? formatCnpj(value) : maskCpf(value);
}

export function documentSchema(type: DocumentType) {
  return type === "cnpj" ? cnpjSchema : cpfSchema;
}

export const documentTypeSchema = z.enum(DOCUMENT_TYPES);

// Reconhece o tipo pelo formato: 11 dígitos com verificadores de CPF, ou 14
// caracteres com verificadores de CNPJ. Sem reconhecer, null.
export function detectDocument(
  value: string,
): { type: DocumentType; document: string } | null {
  const cpf = normalizeCpf(value);
  if (
    /^[\d.\-\s]+$/.test(value.trim()) &&
    cpf.length === 11 &&
    isValidCpf(cpf)
  ) {
    return { type: "cpf", document: cpf };
  }
  const cnpj = normalizeCnpj(value);
  if (cnpj.length === 14 && isValidCnpj(cnpj)) {
    return { type: "cnpj", document: cnpj };
  }
  return null;
}

// Página da parte, pelo tipo e documento.
export function partyHref(type: DocumentType, document: string): string {
  return `${DOCUMENTS[type].basePath}/${document}`;
}

// Uma parte identificada pelo documento, como chega do navegador às actions.
export type PartyRef = { documentType: DocumentType; document: string };

// Valida o tipo e o documento juntos, e devolve o documento sem máscara.
export const partyRefSchema = z
  .object({ documentType: documentTypeSchema, document: z.string() })
  .transform((value, ctx): PartyRef => {
    const parsed = documentSchema(value.documentType).safeParse(value.document);
    if (!parsed.success) {
      ctx.addIssue({
        code: "custom",
        message: `${DOCUMENTS[value.documentType].label} inválido`,
      });
      return z.NEVER;
    }
    return { documentType: value.documentType, document: parsed.data };
  });
