import { describe, expect, it } from "vitest";

import { cnjStates } from "./cnj-states";

// Fictitious numbers: only the J.TR segment matters here.
const ufs = (cnj: string) => cnjStates(cnj).map((s) => s.uf);

describe("cnjStates", () => {
  it("maps a state court by its TR code", () => {
    expect(cnjStates("0000000-39.2026.8.26.0050")).toEqual([
      { uf: "SP", name: "São Paulo" },
    ]);
    expect(ufs("0000000-00.2026.8.23.0001")).toEqual(["RR"]);
    expect(ufs("0000000-00.2026.8.25.0001")).toEqual(["SE"]);
  });

  it("gives every state a regional court covers", () => {
    expect(ufs("0000000-00.2026.4.03.6100")).toEqual(["SP", "MS"]);
    expect(ufs("0000000-00.2026.5.11.0001")).toEqual(["AM", "RR"]);
  });

  it("gives no state to national courts or malformed numbers", () => {
    expect(ufs("0000000-00.2026.3.00.0000")).toEqual([]);
    expect(ufs("0000000-00.2026.8.99.0001")).toEqual([]);
    expect(ufs("123")).toEqual([]);
  });
});
