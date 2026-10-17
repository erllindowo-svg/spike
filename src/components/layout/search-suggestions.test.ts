import { describe, expect, it } from "vitest";

import type { SearchHit } from "@/features/search/hits";

import { buildSuggestions } from "./search-suggestions";

// Fictitious identifiers only.
const CNPJ = "A1B2C3D4E5F668";
const hit = (searchKey: string, label: string): SearchHit => ({
  searchType: "cnpj",
  searchKey,
  label,
  description: "CNPJ",
  monitored: false,
});

describe("buildSuggestions", () => {
  it("needs at least three characters", () => {
    expect(buildSuggestions("em", [])).toEqual([]);
  });

  it("offers a new consult while the search has not answered", () => {
    expect(buildSuggestions("empresa", null).map((s) => s.kind)).toEqual([
      "consult",
    ]);
  });

  it("puts the best result first and the new consult second, like Google", () => {
    const list = buildSuggestions("A1.B2C.3D4/E5F6-68", [
      hit(CNPJ, "Empresa Fictícia"),
      hit("11222333000181", "Outra Empresa"),
    ]);
    expect(list.map((s) => s.kind)).toEqual(["hit", "consult", "hit"]);
    expect(list[0]).toMatchObject({ href: `/acervo/cnpj/${CNPJ}` });
    expect(list[1]).toMatchObject({
      label: "Fazer nova consulta: CNPJ A1.B2C.3D4/E5F6-68",
      href: `/?valor=${CNPJ}&tipo=cnpj`,
    });
  });

  it("says when nothing was found, and still offers the new consult", () => {
    const list = buildSuggestions("erl", []);
    expect(list).toEqual([
      expect.objectContaining({ kind: "notice", label: "Dado não encontrado" }),
      expect.objectContaining({
        kind: "consult",
        href: "/?valor=erl",
      }),
    ]);
  });

  it("does not call a database failure 'not found'", () => {
    expect(buildSuggestions("erl", "error")[0]).toMatchObject({
      label: "Busca indisponível agora",
    });
  });
});
