import { describe, expect, it } from "vitest";

import {
  displaySearchKey,
  fieldDisplay,
  formatSearchKey,
  identify,
  parseSearchKey,
  stripFieldMask,
  type Identification,
} from "./identify";

// Fictitious identifiers: CPFs starting with zeros, the JUDIT test CNPJ and
// the fictitious lawsuit it returns, a textbook numeric CNPJ.
const CPF = "00000000191";
const CNPJ = "A1B2C3D4E5F668";
const NUMERIC_CNPJ = "11222333000181";
const CNJ = "00000003920268260050";

function first(result: Identification) {
  return result.status === "recognized" ? result.candidates[0] : null;
}

function types(result: Identification) {
  return result.status === "recognized"
    ? result.candidates.map((c) => c.type)
    : [];
}

describe("identify", () => {
  it("ignores an empty field", () => {
    expect(identify("   ")).toEqual({ status: "empty" });
  });

  it("recognizes a CPF with or without the mask", () => {
    expect(first(identify("000.000.001-91"))).toEqual({
      type: "cpf",
      key: CPF,
    });
    expect(first(identify(CPF))).toEqual({ type: "cpf", key: CPF });
  });

  it("recognizes numeric and alphanumeric CNPJs", () => {
    expect(first(identify("11.222.333/0001-81"))).toEqual({
      type: "cnpj",
      key: NUMERIC_CNPJ,
    });
    expect(first(identify(NUMERIC_CNPJ))).toEqual({
      type: "cnpj",
      key: NUMERIC_CNPJ,
    });
    expect(first(identify("A1B2C3D4/E5F6-68"))).toEqual({
      type: "cnpj",
      key: CNPJ,
    });
    expect(first(identify("a1.b2c.3d4/e5f6-68"))).toEqual({
      type: "cnpj",
      key: CNPJ,
    });
  });

  it("rejects wrong check digits once the length is complete", () => {
    expect(identify("000.000.001-92")).toMatchObject({
      status: "invalid",
      expected: "cpf",
    });
    expect(identify("11.222.333/0001-82")).toMatchObject({
      status: "invalid",
      expected: "cnpj",
    });
    expect(identify("A1B2C3D4E5F669")).toMatchObject({
      status: "invalid",
      expected: "cnpj",
    });
    expect(identify("0000000-40.2026.8.26.0050")).toMatchObject({
      status: "invalid",
      expected: "cnj",
    });
  });

  describe("CNJ and RJI (both have 20 characters)", () => {
    it("a valid CNJ is a lawsuit, with RJI as the alternative", () => {
      expect(types(identify(CNJ))).toEqual(["cnj", "rji"]);
      expect(types(identify("0000000-39.2026.8.26.0050"))).toEqual(["cnj"]);
    });

    it("20 digits that are not a valid CNJ are an RJI, with a note", () => {
      const result = identify("00000000000000000000");
      expect(types(result)).toEqual(["rji"]);
      expect(result).toMatchObject({ note: expect.stringContaining("CNJ") });
    });

    it("20 characters with letters are an RJI", () => {
      expect(first(identify("AB12CD34EF56GH78IJ90"))).toEqual({
        type: "rji",
        key: "AB12CD34EF56GH78IJ90",
      });
    });
  });

  describe("half-typed identifiers", () => {
    it("the first 11 digits of a CNPJ with its mask stay a CNPJ", () => {
      expect(identify("11.222.333/000")).toMatchObject({
        status: "incomplete",
        expected: ["cnpj"],
      });
    });

    it("without the mask, 11 digits that form a valid CPF are a CPF", () => {
      // Documented behavior: typing the next digits turns it into a CNPJ.
      expect(first(identify("11222333000"))).toBeNull();
      expect(first(identify("52998224725"))).toEqual({
        type: "cpf",
        key: "52998224725",
      });
    });

    it("11 digits that are not a CPF wait for more", () => {
      expect(identify("11222333000")).toMatchObject({
        status: "incomplete",
        expected: ["cnpj", "cnj"],
      });
    });

    it("a partial CNJ with its mask stays a CNJ", () => {
      expect(identify("0000000-39.2026")).toMatchObject({
        status: "incomplete",
        expected: ["cnj"],
      });
    });

    it("a short number could still be anything", () => {
      expect(identify("1234")).toMatchObject({
        status: "incomplete",
        expected: ["cpf", "cnpj", "cnj"],
      });
    });

    it("a partial alphanumeric CNPJ is not taken for a name", () => {
      expect(identify("A1B2C3")).toMatchObject({ status: "incomplete" });
    });
  });

  it("recognizes the OAB in both orders and stores number + UF", () => {
    for (const typed of [
      "123456SP",
      "SP123456",
      "OAB/SP 123456",
      "123456-sp",
    ]) {
      expect(first(identify(typed))).toEqual({ type: "oab", key: "123456SP" });
    }
    expect(first(identify("99999RJ"))).toEqual({ type: "oab", key: "99999RJ" });
    // Not a Brazilian state.
    expect(first(identify("123456XX"))?.type).not.toBe("oab");
  });

  it("takes what is left as a name, with a homonym note", () => {
    const result = identify("  Padaria   de Exemplo ");
    expect(first(result)).toEqual({ type: "name", key: "Padaria de Exemplo" });
    expect(result).toMatchObject({
      note: expect.stringContaining("homônimos"),
    });
    expect(identify("Ana")).toMatchObject({
      status: "incomplete",
      expected: ["name"],
    });
  });
});

describe("parseSearchKey", () => {
  it("returns the normalized key when the type matches", () => {
    expect(parseSearchKey("cpf", "000.000.001-91")).toBe(CPF);
    expect(parseSearchKey("rji", CNJ)).toBe(CNJ);
    expect(parseSearchKey("cnpj", "000.000.001-91")).toBeNull();
    expect(parseSearchKey("cnj", "00000000000000000000")).toBeNull();
  });
});

describe("formatting", () => {
  it("formats each type and masks the CPF in lists", () => {
    expect(formatSearchKey("cnj", CNJ)).toBe("0000000-39.2026.8.26.0050");
    expect(formatSearchKey("oab", "123456SP")).toBe("OAB 123456/SP");
    expect(displaySearchKey("cpf", CPF)).toBe("***.000.001-**");
    expect(displaySearchKey("cnpj", CNPJ)).toBe("A1.B2C.3D4/E5F6-68");
  });
});

describe("identifier field mask", () => {
  function display(value: string) {
    return fieldDisplay(value, first(identify(value)));
  }

  it("formats a recognized CPF, CNPJ or CNJ typed without a mask", () => {
    expect(display(CPF)).toBe("000.000.001-91");
    expect(display(NUMERIC_CNPJ)).toBe("11.222.333/0001-81");
    expect(display(CNJ)).toBe("0000000-39.2026.8.26.0050");
  });

  it("leaves other types, incomplete values and typed masks as they are", () => {
    expect(display("123456SP")).toBeNull();
    expect(display("Maria Silva")).toBeNull();
    expect(display("0000000019")).toBeNull();
    expect(display("000.000.001-91")).toBeNull();
    expect(fieldDisplay(CNJ, { type: "rji", key: CNJ })).toBeNull();
  });

  it("keeps typing past a CPF on the way to a CNPJ", () => {
    const next = stripFieldMask("000.000.001-910");
    expect(next).toBe("000000001910");
    expect(identify(next).status).toBe("incomplete");
  });

  it("backspace on a formatted CPF removes the last digit", () => {
    expect(stripFieldMask("000.000.001-9")).toBe("0000000019");
  });
});
