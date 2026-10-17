import { describe, expect, it } from "vitest";

import type { Tracking } from "@/db/models";

import { exactFirst, monitoredKeys, toHit } from "./hits";

// Fictitious data only.
const CPF = "00000000191";
const CNJ = "00000003920268260050";
const lastSeenAt = new Date("2026-10-12");
const person = {
  searchType: "cpf" as const,
  searchKey: CPF,
  name: "Pessoa Fictícia",
  detail: null,
  lawsuits: 1,
  lastSeenAt,
};
const lawsuit = {
  searchType: "cnj" as const,
  searchKey: CNJ,
  name: null,
  detail: "TJRR · Criminal",
  lawsuits: 0,
  lastSeenAt,
};
const tracking = {
  id: "t1",
  searchType: "cpf",
  searchKey: CPF,
  status: "updated",
  creation: "confirmed",
  updatedAt: new Date("2026-10-11"),
} as Tracking;

describe("search hits", () => {
  it("puts the typed identifier first", () => {
    const sorted = exactFirst("000.000.001-91", [lawsuit, person]);
    expect(sorted[0].searchKey).toBe(CPF);
  });

  it("keeps the order when the text is not an identifier", () => {
    expect(exactFirst("pessoa", [lawsuit, person])).toEqual([lawsuit, person]);
  });

  it("describes a hit with the masked CPF, the count and the monitoring", () => {
    const hit = toHit(person, monitoredKeys([tracking]));
    expect(hit.label).toBe("Pessoa Fictícia");
    expect(hit.description).toContain("***.000.001-**");
    expect(hit.description).toContain("1 processo guardado");
    expect(hit.description).toContain("monitorado");
    expect(hit.monitored).toBe(true);
  });
});
