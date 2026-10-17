import { z } from "zod";

import type { DocumentType } from "@/lib/models";

import { cnpjSchema, formatCnpj, normalizeCnpj } from "./cnpj";
import { cpfSchema, formatCpf, maskCpf, normalizeCpf } from "./cpf";

// O que muda entre empresa (CNPJ) e pessoa física (CPF), num lugar só. As
// telas e as actions perguntam aqui, em vez de conhecerem cada documento.

export type { DocumentType };

export const DOCUMENT_TYPES = [
  "cnpj",
  "cpf",
] as const satisfies readonly DocumentType[];

export type DocumentInfo = {
  label: string;
  // Como a parte é chamada na interface.
  partyLabel: string;
  placeholder: string;
};

export const DOCUMENTS: Record<DocumentType, DocumentInfo> = {
  cnpj: {
    label: "CNPJ",
    partyLabel: "Empresa",
    placeholder: "00.000.000/0000-00",
  },
  cpf: {
    label: "CPF",
    partyLabel: "Pessoa física",
    placeholder: "000.000.000-00",
  },
};

export function normalizeDocument(type: DocumentType, value: string): string {
  return type === "cnpj" ? normalizeCnpj(value) : normalizeCpf(value);
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

// CPF e CNPJ identificam uma parte (coleção `parties`); OAB, nome, RJI e CNJ,
// não.
export function isDocumentType(type: string): type is DocumentType {
  return (DOCUMENT_TYPES as readonly string[]).includes(type);
}

// Página da parte, pelo tipo e documento.
export function partyHref(type: DocumentType, document: string): string {
  // Desde o círculo 3, a página de uma parte é a ficha do assunto.
  return `/acervo/${type}/${document}`;
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
