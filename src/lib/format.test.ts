import { describe, expect, it } from "vitest";

import { lowerFirst } from "./format";

describe("lowerFirst", () => {
  it("lowers only the first letter and keeps acronyms", () => {
    expect(lowerFirst("Processo na base da JUDIT")).toBe(
      "processo na base da JUDIT",
    );
    expect(lowerFirst("Dados cadastrais na Receita")).toBe(
      "dados cadastrais na Receita",
    );
    expect(lowerFirst("Pessoas físicas")).toBe("pessoas físicas");
  });

  it("keeps a label that starts with an acronym", () => {
    expect(lowerFirst("CNPJ")).toBe("CNPJ");
    expect(lowerFirst("IA da JUDIT")).toBe("IA da JUDIT");
  });

  it("handles short and empty labels", () => {
    expect(lowerFirst("")).toBe("");
    expect(lowerFirst("A")).toBe("a");
  });
});
