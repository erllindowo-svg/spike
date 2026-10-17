import { describe, expect, it } from "vitest";

import { hotStorageObservedBody } from "@/lib/judit/__fixtures__/lawsuits";
import { lawsuitsSearchResponseSchema } from "@/lib/judit/schemas/lawsuits";

import { fromJuditLawsuit } from "./judit";

const company = { id: "company-1", document: "A1B2C3D4E5F668" };

function observedLawsuit() {
  const parsed = lawsuitsSearchResponseSchema.parse(hotStorageObservedBody);
  return parsed.lawsuits[0]!;
}

describe("fromJuditLawsuit", () => {
  it("maps the lawsuit observed for the fictitious CNPJ", () => {
    expect(fromJuditLawsuit(observedLawsuit(), company)).toEqual({
      id: "00000003920268260050-1",
      cnj: "00000003920268260050",
      partyId: "company-1",
      tribunal: "TJSP",
      area: null,
      className: null,
      subject: null,
      judgingBody: "20 CRIMINAL DE CENTRAL",
      partyRole: "passive",
      status: null,
      distributedAt: new Date("2026-05-01T03:00:00.000Z"),
      lastMovementAt: null,
      amount: 0,
      movements: [],
    });
  });

  it("treats 'NÃO INFORMADO' as missing data", () => {
    const lawsuit = { ...observedLawsuit(), county: "NÃO INFORMADO" };
    expect(fromJuditLawsuit(lawsuit, company).judgingBody).toBeNull();
  });

  it("reads classifications as strings or as { name } objects", () => {
    const asStrings = {
      ...observedLawsuit(),
      classifications: ["PROCEDIMENTO COMUM CÍVEL"],
    };
    const asObjects = {
      ...observedLawsuit(),
      classifications: [{ code: "7", name: "PROCEDIMENTO COMUM CÍVEL" }],
    };
    expect(fromJuditLawsuit(asStrings, company).className).toBe(
      "PROCEDIMENTO COMUM CÍVEL",
    );
    expect(fromJuditLawsuit(asObjects, company).className).toBe(
      "PROCEDIMENTO COMUM CÍVEL",
    );
  });

  it("accepts side in upper case, as in the lawsuit object docs", () => {
    const lawsuit = {
      ...observedLawsuit(),
      parties: [{ main_document: "A1B2C3D4/E5F6-68", side: "ACTIVE" }],
    };
    expect(fromJuditLawsuit(lawsuit, company).partyRole).toBe("active");
  });

  it("leaves the role unknown when no party has the company's document", () => {
    const lawsuit = {
      ...observedLawsuit(),
      parties: [{ name: "EMPRESA TESTE", side: "Passive", documents: [] }],
    };
    expect(fromJuditLawsuit(lawsuit, company).partyRole).toBeNull();
  });

  it("maps only documented statuses with a clear equivalent", () => {
    const base = observedLawsuit();
    expect(fromJuditLawsuit({ ...base, status: "ATIVO" }, company).status).toBe(
      "active",
    );
    expect(
      fromJuditLawsuit({ ...base, situation: "ARQUIVADO" }, company).status,
    ).toBe("archived");
    expect(
      fromJuditLawsuit({ ...base, status: "FINALIZADO" }, company).status,
    ).toBeNull();
  });
});
