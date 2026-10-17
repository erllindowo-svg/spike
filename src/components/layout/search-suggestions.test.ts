import { describe, expect, it } from "vitest";

import type { Party, Tracking } from "@/db/models";
import type { QueryView } from "@/features/queries/types";
import { buildSubjects } from "@/features/subjects/subjects";

import { buildSuggestions } from "./search-suggestions";

// Fictitious identifiers only.
const CNPJ = "A1B2C3D4E5F668";
const CPF = "00000000191";

const parties = [
  {
    documentType: "cnpj",
    document: CNPJ,
    name: "Empresa Fictícia Ltda.",
    updatedAt: new Date("2026-10-01"),
  },
  {
    documentType: "cpf",
    document: CPF,
    name: "Pessoa Fictícia",
    updatedAt: new Date("2026-10-01"),
  },
] as Party[];

const trackings = [
  {
    id: "t1",
    searchType: "cnpj",
    searchKey: CNPJ,
    status: "updated",
    creation: "confirmed",
    updatedAt: new Date("2026-10-02"),
  },
] as Tracking[];

const queries = [
  {
    id: "q1",
    flow: "sync",
    mode: "datalake_count",
    searchType: "cnpj",
    searchKey: CNPJ,
    createdAt: new Date("2026-10-15T12:00:00Z"),
  },
] as QueryView[];

function suggest(text: string) {
  const subjects = buildSubjects({ queries, trackings, parties, alerts: [] });
  return buildSuggestions(text, { subjects, queries });
}

describe("buildSuggestions", () => {
  it("needs at least two characters", () => {
    expect(suggest("e")).toEqual([]);
  });

  it("finds a subject by name, saying it is monitored and when it was consulted", () => {
    const [first] = suggest("fictícia ltda");
    expect(first).toMatchObject({
      kind: "subject",
      label: "Empresa Fictícia Ltda.",
      href: `/acervo/cnpj/${CNPJ}`,
    });
    expect(first.description).toContain("monitorado");
    expect(first.description).toContain("consultado em 15/10/2026");
  });

  it("masks the CPF of a person found by name", () => {
    const [first] = suggest("pessoa");
    expect(first.description).toContain("***.000.001-**");
    expect(first.description).not.toContain("000.000.001-91");
  });

  it("lists the queries of the typed identifier, then a discreet consult", () => {
    const list = suggest("A1.B2C.3D4/E5F6-68");
    expect(list.map((s) => s.kind)).toEqual(["subject", "query", "consult"]);
    expect(list[1]).toMatchObject({
      label: "Contagem de processos",
      description: "Consulta de 15/10/2026",
    });
    expect(list.at(-1)).toMatchObject({
      label: "Consultar CNPJ A1.B2C.3D4/E5F6-68",
      href: `/?valor=${CNPJ}&tipo=cnpj`,
    });
  });

  it("offers to consult a new identifier, including OAB and names", () => {
    expect(suggest("123456/SP")).toEqual([
      expect.objectContaining({
        kind: "consult",
        href: "/?valor=123456SP&tipo=oab",
      }),
    ]);
    expect(suggest("Padaria de Exemplo").at(-1)).toMatchObject({
      label: "Consultar “Padaria de Exemplo”",
    });
  });
});
