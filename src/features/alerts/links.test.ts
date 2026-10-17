import { describe, expect, it } from "vitest";

import type { Tracking } from "@/db/models";

import { alertHref, unreadAlertsByCnj } from "./links";

// Fictitious identifiers only.
const CNPJ = "A1B2C3D4E5F668";
const CNJ = "00000000000000000000";
const OTHER_CNJ = "11111111111111111111";

const trackings = [{ id: "t1", searchType: "cnpj", searchKey: CNPJ }] as Pick<
  Tracking,
  "id" | "searchType" | "searchKey"
>[];

describe("alertHref", () => {
  it("opens the subject page with the alert's lawsuit", () => {
    expect(alertHref({ trackingId: "t1", lawsuitCnj: CNJ }, trackings)).toBe(
      `/acervo/cnpj/${CNPJ}?processo=${CNJ}`,
    );
  });

  it("opens only the subject page when the alert has no lawsuit", () => {
    expect(alertHref({ trackingId: "t1", lawsuitCnj: null }, trackings)).toBe(
      `/acervo/cnpj/${CNPJ}`,
    );
  });

  it("falls back to the Acervo when the tracking is unknown", () => {
    expect(alertHref({ trackingId: "gone", lawsuitCnj: CNJ }, trackings)).toBe(
      "/acervo",
    );
    expect(alertHref({ trackingId: null, lawsuitCnj: CNJ }, trackings)).toBe(
      "/acervo",
    );
  });
});

describe("unreadAlertsByCnj", () => {
  const alert = (
    id: string,
    overrides: Partial<{
      trackingId: string | null;
      lawsuitCnj: string | null;
      readAt: Date | null;
    }> = {},
  ) => ({
    id,
    trackingId: "t1",
    lawsuitCnj: CNJ,
    readAt: null,
    ...overrides,
  });

  it("groups the unread alerts of the subject's trackings by lawsuit", () => {
    const result = unreadAlertsByCnj(
      [
        alert("a1"),
        alert("a2"),
        alert("a3", { lawsuitCnj: OTHER_CNJ }),
        alert("read", { readAt: new Date("2026-10-17T12:00:00Z") }),
        alert("no-lawsuit", { lawsuitCnj: null }),
        alert("other-subject", { trackingId: "t2" }),
        alert("no-tracking", { trackingId: null }),
      ],
      new Set(["t1"]),
    );
    expect(Object.fromEntries(result)).toEqual({
      [CNJ]: ["a1", "a2"],
      [OTHER_CNJ]: ["a3"],
    });
  });
});
