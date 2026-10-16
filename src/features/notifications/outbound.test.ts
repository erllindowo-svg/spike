import { describe, expect, it, vi } from "vitest";

import type { Alert } from "@/db/models";

import { buildAlertCreatedEvent, publishAlertCreated } from "./outbound";

// Fictitious alert, with lawsuit data that must not leave the app.
const alert: Alert = {
  id: "a0000000-0000-4000-8000-000000000001",
  partyId: "c0000000-0000-4000-8000-000000000001",
  webhookEventId: "e0000000-0000-4000-8000-000000000001",
  trackingId: "t0000000-0000-4000-8000-000000000001",
  lawsuitCnj: "00012340320268260100",
  dedupeKey: "new_lawsuit:t-1:00012340320268260100",
  title: "Novo processo encontrado pelo monitoramento",
  description:
    "Processo 0001234-03.2026.8.26.0100, encontrado pelo monitoramento.",
  type: "new_lawsuit",
  createdAt: new Date("2026-10-16T12:00:00Z"),
  readAt: null,
};

describe("outbound alert.created", () => {
  it("carries only the type and the identifiers", () => {
    const event = buildAlertCreatedEvent(alert);

    expect(event).toEqual({
      type: "alert.created",
      eventId: alert.id,
      alertId: alert.id,
      alertType: "new_lawsuit",
      trackingId: alert.trackingId,
      partyId: alert.partyId,
      occurredAt: "2026-10-16T12:00:00.000Z",
    });
    expect(JSON.stringify(event)).not.toContain("0001234");
  });

  it("sends nothing without a destination, and says so in the log", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    const result = publishAlertCreated(alert);

    expect(result).toMatchObject({
      delivered: false,
      reason: "no_destination",
    });
    expect(info).toHaveBeenCalledWith(
      expect.stringContaining("sem destino configurado"),
    );
    expect(fetch).not.toHaveBeenCalled();
  });
});
