import { beforeEach, describe, expect, it, vi } from "vitest";

import { readJuditAccountAction } from "./account-actions";

// Real JUDIT client with a mocked fetch that answers by URL.

function mockByUrl(responses: Record<string, [unknown, number]>) {
  const fetchMock = vi.fn(async (url: URL) => {
    const [body, status] = responses[url.pathname] ?? [{}, 404];
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.stubEnv("JUDIT_LIVE_CALLS", "enabled");
});

describe("readJuditAccountAction", () => {
  it("reads the documented consumption and the undocumented balance", async () => {
    // Consumption: the docs example (https://docs.judit.io/resource/consumption/current).
    const fetchMock = mockByUrl({
      "/billing/consumption": [
        {
          company_id: "3f6c1d2e-8a4b-4c90-9f1e-27b5ad08c631",
          consumption: 1200,
          max_consumption: 12500,
          remaining: 11300,
          cycle_started_at: "2026-09-01T03:00:00.000Z",
          cycle_ended_at: "2026-10-01T02:59:59.999Z",
        },
        200,
      ],
      // Fictitious: the balance response format is not documented.
      "/credits/balance": [{ balance: 42, nested: { ignored: true } }, 200],
    });

    const result = await readJuditAccountAction();

    expect(result).toMatchObject({
      ok: true,
      consumption: { ok: true, value: { consumption: 1200, remaining: 11300 } },
      balance: { ok: true, value: [["balance", "42"]] },
    });
    const hosts = fetchMock.mock.calls.map(([url]) => url.host).sort();
    expect(hosts).toEqual([
      "requests.production.judit.io",
      "users.production.judit.io",
    ]);
  });

  it("explains a missing billing permission without hiding the balance", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockByUrl({
      "/billing/consumption": [{ error: "Forbidden", message: "no" }, 403],
      "/credits/balance": [{ balance: 7 }, 200],
    });

    const result = await readJuditAccountAction();

    expect(result).toMatchObject({
      ok: true,
      consumption: {
        ok: false,
        message: expect.stringContaining("chave administrativa"),
      },
      balance: { ok: true },
    });
  });
});
