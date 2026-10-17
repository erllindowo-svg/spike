import { describe, expect, it } from "vitest";

import type { JuditRequest, SyncQuery } from "@/lib/models";

import {
  fromJuditRequest,
  fromSyncQuery,
  isQueryOpen,
  mergeQueries,
} from "./types";

// Fictitious identifiers.
const asyncRequest: JuditRequest = {
  id: "q-async",
  requestId: "84b4d8f5-50f8-4c14-818f-912c722a6908",
  partyId: "company-1",
  mode: "historical_async",
  delivery: "webhook",
  searchType: "cnpj",
  searchKey: "A1B2C3D4E5F668",
  cacheTtlInDays: null,
  status: "started",
  createdAt: new Date("2026-10-15T10:00:00Z"),
  updatedAt: new Date("2026-10-15T10:00:00Z"),
  lastCheckedAt: null,
};

const syncQuery: SyncQuery = {
  id: "q-sync",
  mode: "datalake_sync",
  partyId: "company-1",
  searchType: "cnpj",
  searchKey: "A1B2C3D4E5F668",
  requestId: null,
  outcome: "ok",
  resultCount: 3,
  errorKind: null,
  createdAt: new Date("2026-10-15T11:00:00Z"),
};

describe("query views", () => {
  it("keeps what each flow has, and only that", () => {
    expect(fromJuditRequest(asyncRequest)).toMatchObject({
      flow: "async",
      asyncStatus: "started",
      delivery: "webhook",
      syncOutcome: null,
      resultCount: null,
    });
    expect(fromSyncQuery(syncQuery)).toMatchObject({
      flow: "sync",
      syncOutcome: "ok",
      resultCount: 3,
      asyncStatus: null,
      delivery: null,
    });
  });

  it("merges both lists, newest first", () => {
    const merged = mergeQueries(
      [fromJuditRequest(asyncRequest)],
      [fromSyncQuery(syncQuery)],
    );
    expect(merged.map((q) => q.id)).toEqual(["q-sync", "q-async"]);
  });

  it("treats only unfinished async queries as open", () => {
    expect(isQueryOpen(fromJuditRequest(asyncRequest))).toBe(true);
    expect(
      isQueryOpen(fromJuditRequest({ ...asyncRequest, status: "completed" })),
    ).toBe(false);
    expect(isQueryOpen(fromSyncQuery(syncQuery))).toBe(false);
  });
});
