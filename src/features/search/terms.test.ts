import { describe, expect, it } from "vitest";

import { buildTerms, matchesTerms, parseQuery, tokensOf } from "./terms";

const terms = buildTerms(
  ["João da Silva", "Ação de Cobrança", "TJSP"],
  ["A1B2C3D4E5F668", "00000000191"],
);

function match(text: string) {
  const query = parseQuery(text);
  return query ? matchesTerms(terms, query) : false;
}

describe("search terms", () => {
  it("keeps lowercase words without accents", () => {
    expect(tokensOf("Ação Cível/SP")).toEqual(["acao", "civel", "sp"]);
    expect(terms).toContain("a1b2c3d4e5f668");
  });

  it("finds words by their beginning, ignoring case and accents", () => {
    expect(match("joa")).toBe(true);
    expect(match("JOÃO SIL")).toBe(true);
    expect(match("acao cob")).toBe(true);
    // The middle of a word is not found (documented limit of option B).
    expect(match("ilva")).toBe(false);
  });

  it("finds a key typed with or without its mask", () => {
    expect(match("A1.B2C.3D4/E5F6-68")).toBe(true);
    expect(match("000.000.001")).toBe(true);
  });

  it("ignores queries shorter than three characters", () => {
    expect(parseQuery("jo")).toBeNull();
    expect(parseQuery("  ")).toBeNull();
  });

  it("finds a CPF, CNPJ or CNJ by a group from the middle", () => {
    const cpf = buildTerms([], ["52998224725"], "cpf");
    expect(cpf).toEqual(
      expect.arrayContaining(["52998224725", "529", "982", "247", "25"]),
    );
    const query = parseQuery("982.247")!;
    expect(matchesTerms(cpf, query)).toBe(true);
    // Other types keep the whole key only.
    expect(buildTerms([], ["123456SP"], "oab")).toEqual(["123456sp"]);
  });

  it("finds a lawsuit by the state of its court", () => {
    const cnj = buildTerms([], ["00000003920268260050"], "cnj");
    expect(matchesTerms(cnj, parseQuery("São Paulo")!)).toBe(true);
    expect(matchesTerms(cnj, parseQuery("roraima")!)).toBe(false);
  });

  it("needs every typed word", () => {
    expect(match("joao pereira")).toBe(false);
  });
});
