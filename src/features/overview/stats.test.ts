import { describe, expect, it } from "vitest";

import type { Tracking } from "@/features/trackings/types";
import type { QueryView } from "@/features/queries/types";

import {
  countPerDay,
  countQueriesByMode,
  countTrackingsByState,
} from "./stats";

describe("countPerDay", () => {
  it("counts per local day and fills empty days with zero", () => {
    const reference = new Date("2026-10-16T12:00:00-03:00");
    const days = countPerDay(
      [
        new Date("2026-10-16T09:00:00-03:00"),
        new Date("2026-10-16T22:30:00-03:00"),
        new Date("2026-10-14T10:00:00-03:00"),
        // Outside the window.
        new Date("2026-10-01T10:00:00-03:00"),
      ],
      reference,
      3,
    );

    expect(days).toEqual([
      { key: "2026-10-14", label: "14/10", count: 1 },
      { key: "2026-10-15", label: "15/10", count: 0 },
      { key: "2026-10-16", label: "16/10", count: 2 },
    ]);
  });

  it("uses the Sao Paulo day, not the UTC day", () => {
    // 01:30 UTC on the 17th is still the 16th in Sao Paulo.
    const days = countPerDay(
      [new Date("2026-10-17T01:30:00Z")],
      new Date("2026-10-16T12:00:00-03:00"),
      1,
    );
    expect(days[0]).toMatchObject({ key: "2026-10-16", count: 1 });
  });
});

describe("grouped counts", () => {
  const tracking = (status: string | null): Tracking => ({
    id: status ?? "none",
    juditTrackingId: null,
    partyId: null,
    mode: "tracking_document",
    searchType: "cnpj",
    searchKey: "A1B2C3D4E5F668",
    creation: "confirmed",
    creationError: null,
    status,
    recurrenceDays: 30,
    hourRange: null,
    delivery: "webhook",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastCheckedAt: null,
  });

  it("groups trackings by display state, largest first", () => {
    expect(
      countTrackingsByState([
        tracking("updated"),
        tracking("updating"),
        tracking("paused"),
      ]),
    ).toEqual([
      { label: "Ativo", value: 2 },
      { label: "Pausado", value: 1 },
    ]);
  });

  it("groups queries by mode label", () => {
    const query = (mode: QueryView["mode"]) => ({ mode }) as QueryView;
    expect(
      countQueriesByMode([
        query("datalake_sync"),
        query("datalake_sync"),
        query("historical_async"),
      ]),
    ).toEqual([
      { label: "Consulta síncrona", value: 2 },
      { label: "Consulta assíncrona", value: 1 },
    ]);
  });
});
