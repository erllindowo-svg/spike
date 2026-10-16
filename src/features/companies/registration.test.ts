import { describe, expect, it } from "vitest";

import { entityCnpjBody } from "@/lib/judit/__fixtures__/lawsuits";
import { entitiesResponseSchema } from "@/lib/judit/schemas/lawsuits";

import { fromJuditEntities } from "./registration";

// The fixture is the docs example ("Resposta por CNPJ"), with fictitious data.
const parse = (body: unknown) => entitiesResponseSchema.parse(body);
const DOC_CNPJ = "99999999000999";

describe("fromJuditEntities", () => {
  it("reads the legal name and the active flag", () => {
    expect(fromJuditEntities(parse(entityCnpjBody), DOC_CNPJ)).toEqual({
      found: true,
      legalName: "FINGI - EM RECUPERACAO JUDICIAL",
      registrationStatus: "Ativa",
    });
  });

  it("prefers the textual status when JUDIT sends it", () => {
    const body = {
      response_data: [
        {
          ...entityCnpjBody.response_data[0],
          revenue_service_status: "BAIXADA",
          revenue_service_active: false,
        },
      ],
    };
    expect(fromJuditEntities(parse(body), DOC_CNPJ).registrationStatus).toBe(
      "BAIXADA",
    );
  });

  it("picks the entity of the requested CNPJ", () => {
    const body = {
      response_data: [
        {
          entity_type: "company",
          main_document: "11.222.333/0001-81",
          name: "OUTRA",
        },
        {
          entity_type: "company",
          main_document: "99.999.999/0009-99",
          name: "CERTA",
        },
      ],
    };
    expect(fromJuditEntities(parse(body), DOC_CNPJ).legalName).toBe("CERTA");
  });

  it("reports not found on an empty list", () => {
    expect(fromJuditEntities(parse({ response_data: [] }), DOC_CNPJ)).toEqual({
      found: false,
      legalName: null,
      registrationStatus: null,
    });
  });

  it("keeps a missing name as null instead of an empty text", () => {
    const body = {
      response_data: [
        { entity_type: "company", main_document: DOC_CNPJ, name: " " },
      ],
    };
    expect(fromJuditEntities(parse(body), DOC_CNPJ)).toMatchObject({
      found: true,
      legalName: null,
      registrationStatus: null,
    });
  });
});
