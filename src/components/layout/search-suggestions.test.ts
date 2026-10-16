import { describe, expect, it } from "vitest";

import type { Party, Tracking } from "@/db/models";

import { buildSuggestions } from "./search-suggestions";

// Fictitious data.
const at = new Date("2026-10-16T12:00:00Z");
const company: Party = {
  id: "p-1",
  documentType: "cnpj",
  document: "A1B2C3D4E5F668",
  name: "Padaria de Exemplo Ltda.",
  registrationStatus: null,
  createdAt: at,
  updatedAt: at,
};
const person: Party = {
  ...company,
  id: "p-2",
  documentType: "cpf",
  document: "00000000191",
  name: "Joana Exemplo Souza",
};
const tracking: Tracking = {
  id: "t-1",
  juditTrackingId: "j-1",
  partyId: "p-1",
  mode: "tracking_document",
  searchType: "cnpj",
  searchKey: "A1B2C3D4E5F668",
  creation: "confirmed",
  creationError: null,
  status: "updated",
  recurrenceDays: 7,
  hourRange: null,
  delivery: "webhook",
  stepTerms: null,
  createdAt: at,
  updatedAt: at,
  lastCheckedAt: null,
};
const data = {
  parties: [company, person],
  trackings: [tracking],
  lawsuits: [],
};

describe("buildSuggestions", () => {
  it("finds a saved party by name and says it is monitored", () => {
    const [first] = buildSuggestions("padaria", data);
    expect(first).toMatchObject({
      kind: "party",
      label: "Padaria de Exemplo Ltda.",
      description: "Empresa · A1.B2C.3D4/E5F6-68 · monitorada",
      href: "/empresas/A1B2C3D4E5F668",
    });
  });

  it("masks the CPF of a person found by name", () => {
    const [first] = buildSuggestions("joana", data);
    expect(first.description).toBe("Pessoa física · ***.000.001-**");
    expect(first.href).toBe("/pessoas/00000000191");
  });

  it("offers a JUDIT query only for a complete, valid identifier", () => {
    const cnpj = buildSuggestions("A1.B2C.3D4/E5F6-68", data);
    expect(cnpj.at(-1)).toMatchObject({
      kind: "consult",
      href: "/consultar?tipo=cnpj&valor=A1B2C3D4E5F668",
    });
    const cpf = buildSuggestions("000.000.002-72", data);
    expect(cpf).toEqual([
      expect.objectContaining({
        kind: "consult",
        label: "Consultar CPF ***.000.002-** na JUDIT",
      }),
    ]);
    expect(
      buildSuggestions("Padaria inexistente", data).some(
        (s) => s.kind === "consult",
      ),
    ).toBe(false);
  });

  it("ignores one-letter queries", () => {
    expect(buildSuggestions("a", data)).toEqual([]);
  });
});
