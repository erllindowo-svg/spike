import { describe, expect, it } from "vitest";

import { formatCpf, isValidCpf, maskCpf } from "./cpf";
import {
  detectDocument,
  displayDocument,
  partyHref,
  partyRefSchema,
} from "./documents";

// Fictitious documents: CPFs starting with zeros, the JUDIT test CNPJ.
const CPF = "00000000191";
const CNPJ = "A1B2C3D4E5F668";

describe("CPF", () => {
  it("checks the two digits", () => {
    expect(isValidCpf("000.000.001-91")).toBe(true);
    expect(isValidCpf("000.000.001-92")).toBe(false);
    expect(isValidCpf("111.111.111-11")).toBe(false);
    expect(isValidCpf("123")).toBe(false);
  });

  it("formats and masks", () => {
    expect(formatCpf(CPF)).toBe("000.000.001-91");
    expect(maskCpf(CPF)).toBe("***.000.001-**");
  });
});

describe("documents", () => {
  it("recognizes the type by the format", () => {
    expect(detectDocument("000.000.001-91")).toEqual({
      type: "cpf",
      document: CPF,
    });
    expect(detectDocument("A1.B2C.3D4/E5F6-68")).toEqual({
      type: "cnpj",
      document: CNPJ,
    });
    expect(detectDocument("Padaria de Exemplo")).toBeNull();
    expect(detectDocument("000.000.001-92")).toBeNull();
  });

  it("shows the whole CNPJ but masks the CPF in lists", () => {
    expect(displayDocument("cnpj", CNPJ)).toBe("A1.B2C.3D4/E5F6-68");
    expect(displayDocument("cpf", CPF)).toBe("***.000.001-**");
  });

  it("builds the page of each party type", () => {
    expect(partyHref("cnpj", CNPJ)).toBe(`/empresas/${CNPJ}`);
    expect(partyHref("cpf", CPF)).toBe(`/pessoas/${CPF}`);
  });

  it("validates type and document together and strips the mask", () => {
    expect(
      partyRefSchema.parse({ documentType: "cpf", document: "000.000.001-91" }),
    ).toEqual({ documentType: "cpf", document: CPF });
    const wrong = partyRefSchema.safeParse({
      documentType: "cpf",
      document: CNPJ,
    });
    expect(wrong.success).toBe(false);
    expect(wrong.error?.issues[0]?.message).toBe("CPF inválido");
  });
});
