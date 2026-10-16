import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { juditRequest } from "./client";
import { JuditDuplicateCallError, JuditLocalRateLimitError } from "./errors";
import {
  callsInLastMinute,
  DEFAULT_CALLS_PER_MINUTE,
  reserveCallSlot,
  runSingleFlight,
} from "./rate-limit";

// vitest.setup.ts resets the counters before each test.

describe("reserveCallSlot", () => {
  it("allows up to the limit in a 60 s window, then refuses", () => {
    vi.stubEnv("JUDIT_MAX_CALLS_PER_MINUTE", "3");
    const now = 1_000_000;
    reserveCallSlot(now);
    reserveCallSlot(now + 1_000);
    reserveCallSlot(now + 2_000);

    const error = (() => {
      try {
        reserveCallSlot(now + 3_000);
      } catch (caught) {
        return caught;
      }
    })();
    expect(error).toBeInstanceOf(JuditLocalRateLimitError);
    // The oldest call leaves the window 60 s after it was made.
    expect((error as JuditLocalRateLimitError).retryAfterMs).toBe(57_000);
  });

  it("slides: a call older than 60 s frees a slot", () => {
    vi.stubEnv("JUDIT_MAX_CALLS_PER_MINUTE", "1");
    reserveCallSlot(0);
    expect(() => reserveCallSlot(59_999)).toThrow(JuditLocalRateLimitError);
    expect(() => reserveCallSlot(60_000)).not.toThrow();
  });

  it("uses the default when the variable is empty", () => {
    vi.stubEnv("JUDIT_MAX_CALLS_PER_MINUTE", "");
    for (let i = 0; i < DEFAULT_CALLS_PER_MINUTE; i++) reserveCallSlot(i);
    expect(callsInLastMinute(DEFAULT_CALLS_PER_MINUTE)).toBe(
      DEFAULT_CALLS_PER_MINUTE,
    );
    expect(() => reserveCallSlot(DEFAULT_CALLS_PER_MINUTE)).toThrow(
      JuditLocalRateLimitError,
    );
  });
});

describe("runSingleFlight", () => {
  it("refuses an identical call while the first one runs, then frees it", async () => {
    let finish!: () => void;
    const first = runSingleFlight(
      "POST /requests {}",
      () => new Promise<void>((resolve) => (finish = resolve)),
    );

    await expect(
      runSingleFlight("POST /requests {}", async () => {}),
    ).rejects.toBeInstanceOf(JuditDuplicateCallError);

    finish();
    await first;
    await expect(
      runSingleFlight("POST /requests {}", async () => "again"),
    ).resolves.toBe("again");
  });

  it("frees the key when the call fails", async () => {
    await expect(
      runSingleFlight("k", async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    await expect(runSingleFlight("k", async () => 1)).resolves.toBe(1);
  });

  it("never blocks reads (null key)", async () => {
    let finish!: () => void;
    const first = runSingleFlight(
      null,
      () => new Promise<void>((resolve) => (finish = resolve)),
    );
    await expect(runSingleFlight(null, async () => 2)).resolves.toBe(2);
    finish();
    await first;
  });
});

describe("juditRequest with the protections", () => {
  const schema = z.looseObject({ request_id: z.string() });
  const post = () =>
    juditRequest({
      service: "requests",
      method: "POST",
      path: "/requests",
      body: { search: { search_type: "cnpj", search_key: "A1B2C3D4E5F668" } },
      schema,
    });

  it("sends a second identical POST only after the first one answers", async () => {
    vi.stubEnv("JUDIT_LIVE_CALLS", "enabled");
    let answer!: (response: Response) => void;
    const fetchMock = vi.fn(
      () => new Promise<Response>((resolve) => (answer = resolve)),
    );
    vi.stubGlobal("fetch", fetchMock);

    const first = post();
    await expect(post()).rejects.toBeInstanceOf(JuditDuplicateCallError);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    answer(Response.json({ request_id: "r-1" }));
    await expect(first).resolves.toMatchObject({ request_id: "r-1" });
  });

  it("refuses before fetch when the per-minute limit is reached", async () => {
    vi.stubEnv("JUDIT_LIVE_CALLS", "enabled");
    vi.stubEnv("JUDIT_MAX_CALLS_PER_MINUTE", "1");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ request_id: "r-1" })),
    );

    await post();
    await expect(post()).rejects.toBeInstanceOf(JuditLocalRateLimitError);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
