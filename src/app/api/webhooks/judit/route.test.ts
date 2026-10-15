import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  fakeWebhookToken,
  requestCompletedDelivery,
  trackingLawsuitDelivery,
} from "@/lib/judit/__fixtures__/webhooks";

import { POST } from "./route";

// The database is replaced by a mock: here the subject is the HTTP contract
// (which status JUDIT gets in each case). Storage itself is tested in
// src/features/webhooks/db.test.ts against a real in-memory MongoDB.
const saveWebhookEvent = vi.hoisted(() => vi.fn());
vi.mock("@/features/webhooks/db", () => ({ saveWebhookEvent }));

const logs = {
  info: vi.spyOn(console, "info").mockImplementation(() => {}),
  warn: vi.spyOn(console, "warn").mockImplementation(() => {}),
  error: vi.spyOn(console, "error").mockImplementation(() => {}),
};

function deliver(body: unknown, token: string | null = fakeWebhookToken) {
  const url = new URL("http://127.0.0.1:3000/api/webhooks/judit");
  if (token !== null) url.searchParams.set("token", token);
  return POST(
    new Request(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

function allLogText() {
  return Object.values(logs)
    .flatMap((spy) => spy.mock.calls.flat())
    .map(String)
    .join("\n");
}

beforeEach(() => {
  vi.stubEnv("DATA_SOURCE", "db");
  vi.stubEnv("JUDIT_WEBHOOK_TOKEN", fakeWebhookToken);
  vi.stubEnv("JUDIT_WEBHOOK_FULL_PAYLOAD", "");
  saveWebhookEvent.mockReset();
  saveWebhookEvent.mockResolvedValue({ duplicate: false, event: {} });
  Object.values(logs).forEach((spy) => spy.mockClear());
});

describe("POST /api/webhooks/judit", () => {
  it("stores a valid delivery before answering 200", async () => {
    const response = await deliver(requestCompletedDelivery);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "received",
      duplicate: false,
    });
    expect(saveWebhookEvent).toHaveBeenCalledOnce();
    const [event] = saveWebhookEvent.mock.calls[0];
    expect(event.callbackId).toBe("b2f7c86c-0bdc-4f26-a42f-7f4760dba80f");
    expect(JSON.stringify(event)).not.toContain(fakeWebhookToken);
  });

  it("answers 200 to a redelivery already stored, so JUDIT stops retrying", async () => {
    saveWebhookEvent.mockResolvedValue({ duplicate: true, event: null });

    const response = await deliver(requestCompletedDelivery);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "received",
      duplicate: true,
    });
  });

  it("answers 503 when storage fails, so JUDIT retries", async () => {
    saveWebhookEvent.mockRejectedValue(new Error("connection refused"));

    const response = await deliver(requestCompletedDelivery);

    expect(response.status).toBe(503);
    expect(allLogText()).toContain("connection refused");
  });

  it("answers 400 to a body that is not JSON, without storing", async () => {
    const response = await deliver("{not json");

    expect(response.status).toBe(400);
    expect(saveWebhookEvent).not.toHaveBeenCalled();
  });

  it("answers 400 to an envelope with a wrong type, logging only the paths", async () => {
    const response = await deliver({
      ...requestCompletedDelivery,
      callback_id: 42,
    });

    expect(response.status).toBe(400);
    expect(saveWebhookEvent).not.toHaveBeenCalled();
    expect(allLogText()).toContain("callback_id");
  });

  it.each([
    ["missing", null],
    ["wrong", "f".repeat(64)],
  ])("answers 401 to a %s token, without storing", async (_, token) => {
    const response = await deliver(requestCompletedDelivery, token);

    expect(response.status).toBe(401);
    expect(saveWebhookEvent).not.toHaveBeenCalled();
  });

  it("is off (404) without a token configured", async () => {
    vi.stubEnv("JUDIT_WEBHOOK_TOKEN", "");

    expect((await deliver(requestCompletedDelivery)).status).toBe(404);
  });

  it("is off (404) outside the db mode", async () => {
    vi.stubEnv("DATA_SOURCE", "demo");

    expect((await deliver(requestCompletedDelivery)).status).toBe(404);
  });

  it("answers 503 to an invalid token configuration, so JUDIT retries", async () => {
    vi.stubEnv("JUDIT_WEBHOOK_TOKEN", "short");

    const response = await deliver(requestCompletedDelivery, "short");

    expect(response.status).toBe(503);
    expect(allLogText()).not.toContain("short");
  });

  it("stores lawsuit data only in maintenance mode", async () => {
    await deliver(trackingLawsuitDelivery);
    vi.stubEnv("JUDIT_WEBHOOK_FULL_PAYLOAD", "enabled");
    await deliver(trackingLawsuitDelivery);

    const [[reduced], [full]] = saveWebhookEvent.mock.calls;
    expect(JSON.stringify(reduced)).not.toContain("USUÁRIO EXEMPLO 2");
    expect(JSON.stringify(full)).toContain("USUÁRIO EXEMPLO 2");
  });

  it("never writes the token to the log", async () => {
    await deliver(requestCompletedDelivery);
    await deliver(requestCompletedDelivery, "f".repeat(64));
    saveWebhookEvent.mockRejectedValue(
      new Error(`failed with ${fakeWebhookToken}`),
    );
    await deliver(requestCompletedDelivery);

    expect(allLogText()).not.toContain(fakeWebhookToken);
  });
});
