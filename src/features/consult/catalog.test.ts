import { describe, expect, it } from "vitest";

import {
  CONSULT_FEATURES,
  consultableTypes,
  featuresFor,
  purposeFor,
  trackingFor,
} from "./catalog";

describe("consult catalog", () => {
  it("offers every identifier the app recognizes", () => {
    expect(consultableTypes().sort()).toEqual(
      ["cnj", "cnpj", "cpf", "name", "oab", "rji"].sort(),
    );
  });

  it("keeps RJI only for arrest warrants (decision D3)", () => {
    expect(featuresFor("rji").map((f) => f.id)).toEqual(["warrants"]);
  });

  it("has a question and a timing text for every query", () => {
    for (const feature of CONSULT_FEATURES) {
      expect(feature.question).toMatch(/\?$/);
      expect(feature.timing).not.toBe("");
    }
  });

  it("offers tracking only where JUDIT tracks that identifier", () => {
    expect(trackingFor("count", "oab")?.mode).toBe("tracking_document");
    expect(trackingFor("lawsuit_async", "cnj")?.mode).toBe("tracking_lawsuit");
    // Name searches: JUDIT tracks cpf, cnpj and oab only.
    expect(trackingFor("count", "name")).toBeNull();
    // Registration data, warrants and penal execution are not tracked.
    expect(trackingFor("registration", "cnpj")).toBeNull();
    expect(trackingFor("warrants", "cpf")).toBeNull();
    expect(trackingFor("criminal_execution", "cpf")).toBeNull();
  });

  it("explains each query for the recognized identifier (circle 3B)", () => {
    expect(purposeFor("registration", "cpf")).toContain("pessoa");
    expect(purposeFor("registration", "cpf")).not.toContain("empresa");
    expect(purposeFor("registration", "cnpj")).toContain("empresa");
    expect(purposeFor("warrants", "rji")).toContain("RJI");
    // Without its own text, the general one of the modality.
    expect(purposeFor("count", "oab")).toContain("total de processos");
  });
});
