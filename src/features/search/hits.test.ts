import { describe, expect, it } from "vitest";

import type { Party, Tracking } from "@/db/models";
import type { Lawsuit } from "@/features/processes/types";

import {
  demoEntries,
  exactFirst,
  monitoredKeys,
  searchDemoEntries,
  toHit,
} from "./hits";

// Fictitious data only.
const CPF = "00000000191";
const party = {
  id: "p1",
  documentType: "cpf",
  document: CPF,
  name: "Pessoa Fictícia",
  registrationStatus: null,
  updatedAt: new Date("2026-10-10"),
} as Party;
const lawsuit = {
  id: "l1",
  cnj: "00000003920268260050",
  partyId: "p1",
  tribunal: "TJRR",
  area: "Criminal",
  lastMovementAt: new Date("2026-10-12"),
} as Lawsuit;
const tracking = {
  id: "t1",
  searchType: "cpf",
  searchKey: CPF,
  status: "updated",
  creation: "confirmed",
  updatedAt: new Date("2026-10-11"),
} as Tracking;

const entries = demoEntries({
  parties: [party],
  lawsuits: [lawsuit],
  queries: [],
  trackings: [tracking],
});

describe("search hits", () => {
  it("searches the fictitious data with the same prefix rule", () => {
    expect(searchDemoEntries("pess", entries).map((e) => e.searchKey)).toEqual([
      CPF,
    ]);
    expect(searchDemoEntries("crim", entries).map((e) => e.searchType)).toEqual(
      ["cnj"],
    );
  });

  it("puts the typed identifier first", () => {
    const sorted = exactFirst("000.000.001-91", [...entries].reverse());
    expect(sorted[0].searchKey).toBe(CPF);
  });

  it("describes a hit with the masked CPF, the count and the monitoring", () => {
    const person = entries.find((e) => e.searchKey === CPF)!;
    const hit = toHit(person, monitoredKeys([tracking]));
    expect(hit.label).toBe("Pessoa Fictícia");
    expect(hit.description).toContain("***.000.001-**");
    expect(hit.description).toContain("1 processo guardado");
    expect(hit.description).toContain("monitorado");
    expect(hit.monitored).toBe(true);
  });
});
