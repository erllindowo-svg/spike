import { describe, expect, it } from "vitest";

import type { Party, Tracking } from "@/db/models";
import type { AlertView } from "@/features/alerts/types";
import type { QueryView } from "@/features/queries/types";

import { buildSubjects, filterSubjects, subjectHref } from "./subjects";

// Fictitious identifiers only.
const CNPJ = "A1B2C3D4E5F668";
const at = (day: number) =>
  new Date(`2026-10-${String(day).padStart(2, "0")}T12:00:00Z`);

function query(overrides: Partial<QueryView>): QueryView {
  return {
    id: Math.random().toString(),
    flow: "sync",
    mode: "datalake_count",
    partyId: null,
    searchType: "cnpj",
    searchKey: CNPJ,
    createdAt: at(1),
    requestId: null,
    asyncStatus: null,
    syncOutcome: "ok",
    resultCount: 1,
    delivery: null,
    ...overrides,
  } as QueryView;
}

const tracking = {
  id: "t1",
  searchType: "cnpj",
  searchKey: CNPJ,
  status: "updated",
  creation: "confirmed",
  updatedAt: at(3),
} as Tracking;

const party = {
  documentType: "cnpj",
  document: CNPJ,
  name: "Empresa Fictícia",
  updatedAt: at(2),
} as Party;

describe("buildSubjects", () => {
  it("joins queries, trackings, parties and unread alerts per identifier", () => {
    const subjects = buildSubjects({
      queries: [
        query({ createdAt: at(1) }),
        query({ createdAt: at(5) }),
        query({ searchType: "name", searchKey: "Padaria de Exemplo" }),
      ],
      trackings: [tracking],
      parties: [party],
      alerts: [
        { trackingId: "t1", readAt: null } as AlertView,
        { trackingId: "t1", readAt: at(4) } as AlertView,
      ],
    });

    expect(subjects).toHaveLength(2);
    expect(subjects[0]).toMatchObject({
      searchType: "cnpj",
      name: "Empresa Fictícia",
      queries: 2,
      lastQueryAt: at(5),
      monitored: true,
      unreadAlerts: 1,
      lastActivityAt: at(5),
    });
    // A name search is named by itself.
    expect(subjects[1]).toMatchObject({
      searchType: "name",
      name: "Padaria de Exemplo",
    });
  });

  it("ignores deleted trackings and counts paused ones as not monitored", () => {
    const subjects = buildSubjects({
      queries: [],
      trackings: [
        { ...tracking, status: "deleted" },
        {
          ...tracking,
          id: "t2",
          searchKey: "11222333000181",
          status: "paused",
        },
      ],
      parties: [],
      alerts: [],
    });
    expect(subjects).toHaveLength(1);
    expect(subjects[0]).toMatchObject({ trackings: 1, monitored: false });
  });
});

describe("filterSubjects", () => {
  const subjects = buildSubjects({
    queries: [query({}), query({ searchType: "oab", searchKey: "123456SP" })],
    trackings: [tracking],
    parties: [party],
    alerts: [],
  });

  it("filters by type, monitored and text", () => {
    const base = { type: "all" as const, monitoredOnly: false, text: "" };
    expect(filterSubjects(subjects, { ...base, type: "oab" })).toHaveLength(1);
    expect(
      filterSubjects(subjects, { ...base, monitoredOnly: true }),
    ).toHaveLength(1);
    expect(
      filterSubjects(subjects, { ...base, text: "fictícia" }),
    ).toHaveLength(1);
    expect(filterSubjects(subjects, { ...base, text: "123.456" })).toHaveLength(
      1,
    );
  });
});

it("encodes the key of the subject page", () => {
  expect(subjectHref("name", "Padaria de Exemplo")).toBe(
    "/acervo/name/Padaria%20de%20Exemplo",
  );
});
