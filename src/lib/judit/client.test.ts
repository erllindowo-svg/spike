import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import {
  applicationErrorBody,
  notFoundBody,
  tooManyRequestsBody,
  unauthorizedBody,
} from "./__fixtures__/errors";
import { juditRequest } from "./client";
import {
  JuditApplicationError,
  JuditHttpError,
  JuditLiveCallsDisabledError,
  JuditNetworkError,
  JuditRateLimitError,
  JuditTimeoutError,
  JuditUnexpectedResponseError,
} from "./errors";

const API_KEY = "test-key-never-real";

const schema = z.looseObject({ request_id: z.string() });

function call(timeoutMs?: number) {
  return juditRequest({
    service: "requests",
    method: "GET",
    path: "/requests/abc",
    schema,
    timeoutMs,
  });
}

function mockFetch(response: Response) {
  const fetchMock = vi.fn(async () => response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

async function catchError(promise: Promise<unknown>): Promise<Error> {
  try {
    await promise;
  } catch (error) {
    return error as Error;
  }
  throw new Error("Expected the call to fail.");
}

// Serializes everything an error carries, including fields and cause, so a
// leak anywhere in the object is caught.
function dump(error: Error): string {
  return JSON.stringify({
    ...error,
    message: error.message,
    stack: error.stack,
    cause: error.cause,
  });
}

describe("kill switch", () => {
  it("fails before fetch runs when JUDIT_LIVE_CALLS is not 'enabled'", async () => {
    const fetchMock = mockFetch(jsonResponse({ request_id: "abc" }));

    await expect(call()).rejects.toBeInstanceOf(JuditLiveCallsDisabledError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("with live calls enabled", () => {
  beforeEach(() => {
    vi.stubEnv("JUDIT_LIVE_CALLS", "enabled");
  });

  it("sends the api-key header to the service base URL", async () => {
    const fetchMock = mockFetch(jsonResponse({ request_id: "abc" }));

    await expect(call()).resolves.toEqual({ request_id: "abc" });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      URL,
      RequestInit,
    ];
    expect(url.toString()).toBe(
      "https://requests.production.judit.io/requests/abc",
    );
    expect(init.headers).toMatchObject({ "api-key": API_KEY });
    expect(init.method).toBe("GET");
  });

  it("parses a response with extra unknown fields", async () => {
    mockFetch(
      jsonResponse({ request_id: "abc", brand_new_field: { nested: true } }),
    );

    await expect(call()).resolves.toMatchObject({
      request_id: "abc",
      brand_new_field: { nested: true },
    });
  });

  it("maps HTTP 401 to JuditHttpError without leaking the key", async () => {
    mockFetch(jsonResponse(unauthorizedBody, { status: 401 }));

    const error = await catchError(call());

    expect(error).toBeInstanceOf(JuditHttpError);
    expect(error).not.toBeInstanceOf(JuditRateLimitError);
    expect(error).toMatchObject({
      status: 401,
      errorName: "HttpUnauthorizedError",
      call: { method: "GET", path: "/requests/abc" },
    });
    expect(dump(error)).not.toContain(API_KEY);
  });

  it("redacts the key even if JUDIT echoes it in the body", async () => {
    mockFetch(
      jsonResponse(
        { error: { name: "HttpBadRequestError", data: `bad ${API_KEY}` } },
        { status: 400 },
      ),
    );

    const error = await catchError(call());

    expect(error).toBeInstanceOf(JuditHttpError);
    expect(dump(error)).not.toContain(API_KEY);
  });

  it("maps HTTP 404 to JuditHttpError", async () => {
    mockFetch(jsonResponse(notFoundBody, { status: 404 }));

    await expect(call()).rejects.toMatchObject({
      status: 404,
      errorName: "REQUEST_NOT_FOUND",
    });
  });

  it("maps HTTP 429 to JuditRateLimitError with rate-limit headers", async () => {
    mockFetch(
      jsonResponse(tooManyRequestsBody, {
        status: 429,
        headers: {
          "retry-after": "12",
          "x-ratelimit-limit": "180",
          "x-ratelimit-remaining": "0",
        },
      }),
    );

    const error = await catchError(call());

    expect(error).toBeInstanceOf(JuditRateLimitError);
    expect(error).toMatchObject({
      status: 429,
      errorName: "Too Many Requests",
      rateLimit: {
        retryAfter: "12",
        limit: "180",
        remaining: "0",
        reset: null,
      },
    });
  });

  it("detects an application error inside HTTP 200", async () => {
    mockFetch(jsonResponse(applicationErrorBody));

    const error = await catchError(call());

    expect(error).toBeInstanceOf(JuditApplicationError);
    expect(error).toMatchObject({ code: "LAWSUIT_NOT_FOUND" });
  });

  it("detects a top-level application error with a numeric code", async () => {
    mockFetch(
      jsonResponse({
        response_id: "b6c1a4f0-1234-5678-9abc-def012345678",
        response_type: "application_error",
        response_data: { code: 404, message: "not found" },
      }),
    );

    const error = await catchError(call());

    expect(error).toBeInstanceOf(JuditApplicationError);
    expect(error).toMatchObject({ code: 404 });
  });

  it("rejects a 200 body that does not match the schema", async () => {
    mockFetch(jsonResponse({ something_else: true }));

    const error = await catchError(call());

    expect(error).toBeInstanceOf(JuditUnexpectedResponseError);
    expect(error).toMatchObject({ issues: ["request_id: invalid_type"] });
  });

  it("rejects a 200 body that is not JSON", async () => {
    mockFetch(new Response("<html>gateway</html>", { status: 200 }));

    await expect(call()).rejects.toBeInstanceOf(JuditUnexpectedResponseError);
  });

  it("maps a timeout to JuditTimeoutError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: URL, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener("abort", () =>
              reject(new DOMException("aborted", "AbortError")),
            );
          }),
      ),
    );

    const error = await catchError(call(5));

    expect(error).toBeInstanceOf(JuditTimeoutError);
    expect(error).toMatchObject({ kind: "timeout", timeoutMs: 5 });
  });

  it("maps a connection failure to JuditNetworkError without leaking the key", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    );

    const error = await catchError(call());

    expect(error).toBeInstanceOf(JuditNetworkError);
    expect(error).not.toBeInstanceOf(JuditTimeoutError);
    expect(dump(error)).not.toContain(API_KEY);
  });
});
