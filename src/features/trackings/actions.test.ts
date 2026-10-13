import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTrackingAction } from "./actions";
import { createTracking } from "./db";

// The action is tested on its own: the database functions are covered in
// db.test.ts, and refresh() only works inside a real Next.js request.
vi.mock("./db", () => ({ createTracking: vi.fn() }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
const { refresh } = await import("next/cache");

const input = {
  searchType: "cnpj",
  searchKey: "A1B2C3D4E5F668",
  recurrenceDays: 7,
} as const;

beforeEach(() => {
  vi.mocked(createTracking).mockReset();
  vi.mocked(refresh).mockReset();
});

describe("createTrackingAction", () => {
  it("refuses to write in demo mode, even when called directly", async () => {
    vi.stubEnv("DATA_SOURCE", "demo");

    expect(await createTrackingAction(input)).toEqual({
      ok: false,
      reason: "unavailable",
    });
    expect(createTracking).not.toHaveBeenCalled();
  });

  it("defaults to demo mode when DATA_SOURCE is not set", async () => {
    vi.stubEnv("DATA_SOURCE", undefined);

    expect(await createTrackingAction(input)).toMatchObject({
      reason: "unavailable",
    });
  });

  it("saves in db mode and refreshes the page data", async () => {
    vi.stubEnv("DATA_SOURCE", "db");
    const result = { ok: true, tracking: { id: "t1" } } as never;
    vi.mocked(createTracking).mockResolvedValue(result);

    expect(await createTrackingAction(input)).toBe(result);
    expect(createTracking).toHaveBeenCalledWith(input);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("passes a duplicate through without refreshing", async () => {
    vi.stubEnv("DATA_SOURCE", "db");
    vi.mocked(createTracking).mockResolvedValue({
      ok: false,
      reason: "duplicate",
    });

    expect(await createTrackingAction(input)).toEqual({
      ok: false,
      reason: "duplicate",
    });
    expect(refresh).not.toHaveBeenCalled();
  });

  it("turns a database failure into a generic error, without details", async () => {
    vi.stubEnv("DATA_SOURCE", "db");
    vi.mocked(createTracking).mockRejectedValue(
      new Error("connect ECONNREFUSED cluster0.exemplo.mongodb.net"),
    );
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await createTrackingAction(input)).toEqual({
      ok: false,
      reason: "error",
    });
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});
