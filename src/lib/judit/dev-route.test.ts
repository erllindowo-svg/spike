import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/dev/judit/lawsuits/count/route";
import { GET as listRequestsRoute } from "@/app/api/dev/judit/requests/route";
import { DELETE as deleteTrackingRoute } from "@/app/api/dev/judit/tracking/[trackingId]/route";

function countRequest(body: unknown) {
  return new Request("http://localhost/api/dev/judit/lawsuits/count", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const validInput = { searchType: "cnpj", searchKey: "A1B2C3D4/E5F6-68" };

describe("dev JUDIT routes", () => {
  it("answer 404 outside development, even with the kill switch on", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("JUDIT_LIVE_CALLS", "enabled");

    const response = await POST(countRequest(validInput));

    expect(response.status).toBe(404);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("answer 404 in development when the kill switch is off", async () => {
    vi.stubEnv("NODE_ENV", "development");

    const response = await POST(countRequest(validInput));

    expect(response.status).toBe(404);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("reject invalid input with 400 before calling JUDIT", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("JUDIT_LIVE_CALLS", "enabled");

    const response = await POST(countRequest({ searchType: "passport" }));

    expect(response.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("answer 403 for a key outside the allowlist", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("JUDIT_LIVE_CALLS", "enabled");

    const response = await POST(
      countRequest({ searchType: "cnpj", searchKey: "99.999.999/9999-99" }),
    );

    expect(response.status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("return the JUDIT result when everything is allowed", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("JUDIT_LIVE_CALLS", "enabled");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ total: 12 })),
    );

    const response = await POST(countRequest(validInput));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ total: 12 });
  });
});

describe("dev JUDIT GET routes with query parameters", () => {
  const url = "http://localhost/api/dev/judit/requests";

  it("answer 404 outside development", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("JUDIT_LIVE_CALLS", "enabled");

    const response = await listRequestsRoute(new Request(url));

    expect(response.status).toBe(404);
  });

  it("reject a missing required date range with 400", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("JUDIT_LIVE_CALLS", "enabled");

    const response = await listRequestsRoute(new Request(`${url}?page=1`));

    expect(response.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("pass coerced query values to JUDIT", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("JUDIT_LIVE_CALLS", "enabled");
    const fetchMock = vi.fn(async () =>
      Response.json({
        page: 2,
        page_count: 0,
        all_pages_count: 2,
        all_count: 5,
        page_data: [],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await listRequestsRoute(
      new Request(
        `${url}?created_at_gte=2024-02-01T00:00:00.000Z&created_at_lte=2024-02-29T00:00:00.000Z&page=2&page_size=5`,
      ),
    );

    expect(response.status).toBe(200);
    const [sentUrl] = fetchMock.mock.calls[0] as unknown as [URL];
    expect(new URL(sentUrl).searchParams.get("page_size")).toBe("5");
  });
});

describe("dev JUDIT tracking DELETE route", () => {
  const trackingId = "15d632c6-a2ab-40c1-bfc5-d8f7bf8d8dd9";
  const url = `http://localhost/api/dev/judit/tracking/${trackingId}`;
  const ctx = { params: Promise.resolve({ trackingId }) };

  it("refuses to delete without ?confirm=delete", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("JUDIT_LIVE_CALLS", "enabled");

    const response = await deleteTrackingRoute(
      new NextRequest(url, { method: "DELETE" }),
      ctx,
    );

    expect(response.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("deletes when confirmed", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("JUDIT_LIVE_CALLS", "enabled");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ tracking_id: trackingId, status: "deleted" }),
      ),
    );

    const response = await deleteTrackingRoute(
      new NextRequest(`${url}?confirm=delete`, { method: "DELETE" }),
      ctx,
    );

    expect(response.status).toBe(200);
    expect(fetch).toHaveBeenCalledOnce();
  });
});
