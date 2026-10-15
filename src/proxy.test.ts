import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { isLocalRequest, proxy } from "./proxy";

function request(path: string, headers: Record<string, string>) {
  return new NextRequest(new URL(path, "http://127.0.0.1:3000"), { headers });
}

// NextResponse.next() lets the request continue; anything else is a 404.
function passes(response: Response) {
  return response.status !== 404;
}

const tunnel = {
  host: "abc-def.trycloudflare.com",
  "cf-connecting-ip": "203.0.113.7",
  "cf-ray": "8d1f2a3b4c5d6e7f-GRU",
};

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "development");
});

describe("isLocalRequest", () => {
  it.each(["127.0.0.1:3000", "localhost:3000", "localhost", "[::1]:3000"])(
    "accepts %s",
    (host) => {
      expect(isLocalRequest(new Headers({ host }))).toBe(true);
    },
  );

  it("refuses a public host", () => {
    expect(isLocalRequest(new Headers({ host: tunnel.host }))).toBe(false);
  });

  it("refuses a local host that came through Cloudflare", () => {
    // A tunnel configured to rewrite Host (--http-host-header) still adds
    // the Cloudflare headers.
    expect(
      isLocalRequest(
        new Headers({ host: "127.0.0.1:3000", "cf-ray": tunnel["cf-ray"] }),
      ),
    ).toBe(false);
  });
});

describe("proxy (development)", () => {
  it("lets the tunnel reach only the webhook route", () => {
    expect(passes(proxy(request("/api/webhooks/judit", tunnel)))).toBe(true);
    for (const path of [
      "/",
      "/monitoramentos",
      "/api/dev/judit/lawsuits/count",
      "/api/dev/webhooks",
      "/api/webhooks/judit/extra",
    ]) {
      expect(passes(proxy(request(path, tunnel))), path).toBe(false);
    }
  });

  it("lets this machine reach everything", () => {
    expect(
      passes(proxy(request("/monitoramentos", { host: "127.0.0.1:3000" }))),
    ).toBe(true);
  });

  it("does nothing outside development", () => {
    vi.stubEnv("NODE_ENV", "production");

    expect(passes(proxy(request("/monitoramentos", tunnel)))).toBe(true);
  });
});
