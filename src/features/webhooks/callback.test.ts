import { describe, expect, it, vi } from "vitest";

import { fakeWebhookToken } from "@/lib/judit/__fixtures__/webhooks";

import {
  buildJuditCallbackUrl,
  fullPayloadEnabled,
  getWebhookToken,
  isValidWebhookToken,
  productCallbackUrl,
  redactToken,
} from "./callback";

describe("isValidWebhookToken", () => {
  it("accepts only the exact token", () => {
    expect(isValidWebhookToken(fakeWebhookToken, fakeWebhookToken)).toBe(true);
    expect(isValidWebhookToken(`${fakeWebhookToken}x`, fakeWebhookToken)).toBe(
      false,
    );
    expect(isValidWebhookToken("curto", fakeWebhookToken)).toBe(false);
  });

  it("refuses a missing or empty token", () => {
    expect(isValidWebhookToken(null, fakeWebhookToken)).toBe(false);
    expect(isValidWebhookToken("", fakeWebhookToken)).toBe(false);
  });
});

describe("getWebhookToken", () => {
  it("is undefined (webhook off) when the variable is empty or absent", () => {
    // `JUDIT_WEBHOOK_TOKEN=` copied from .env.example arrives as "". It must
    // mean "off" (404), not "invalid" (503, which JUDIT would retry).
    vi.stubEnv("JUDIT_WEBHOOK_TOKEN", "");
    expect(getWebhookToken()).toBeUndefined();

    vi.stubEnv("JUDIT_WEBHOOK_TOKEN", "   ");
    expect(getWebhookToken()).toBeUndefined();

    vi.stubEnv("JUDIT_WEBHOOK_TOKEN", undefined);
    expect(getWebhookToken()).toBeUndefined();
  });

  it("refuses a token shorter than 32 characters", () => {
    vi.stubEnv("JUDIT_WEBHOOK_TOKEN", "short");

    expect(() => getWebhookToken()).toThrow(/JUDIT_WEBHOOK_TOKEN/);
  });
});

describe("buildJuditCallbackUrl", () => {
  it("puts the token in the webhook path of the public origin", () => {
    vi.stubEnv("JUDIT_WEBHOOK_TOKEN", fakeWebhookToken);

    expect(buildJuditCallbackUrl("https://abc.trycloudflare.com/ignored")).toBe(
      `https://abc.trycloudflare.com/api/webhooks/judit?token=${fakeWebhookToken}`,
    );
  });

  it("refuses an http origin", () => {
    vi.stubEnv("JUDIT_WEBHOOK_TOKEN", fakeWebhookToken);

    expect(() => buildJuditCallbackUrl("http://abc.example")).toThrow(/https/);
  });
});

describe("productCallbackUrl", () => {
  it("is null (polling only) without a public origin", () => {
    vi.stubEnv("JUDIT_WEBHOOK_PUBLIC_ORIGIN", "");
    vi.stubEnv("JUDIT_WEBHOOK_TOKEN", fakeWebhookToken);

    expect(productCallbackUrl()).toBeNull();
  });

  it("builds the callback_url from the configured origin", () => {
    vi.stubEnv(
      "JUDIT_WEBHOOK_PUBLIC_ORIGIN",
      "https://exemplo.trycloudflare.com",
    );
    vi.stubEnv("JUDIT_WEBHOOK_TOKEN", fakeWebhookToken);

    expect(productCallbackUrl()).toBe(
      `https://exemplo.trycloudflare.com/api/webhooks/judit?token=${fakeWebhookToken}`,
    );
  });

  it("refuses an origin with a path, http, or without a token", () => {
    vi.stubEnv("JUDIT_WEBHOOK_TOKEN", fakeWebhookToken);
    vi.stubEnv("JUDIT_WEBHOOK_PUBLIC_ORIGIN", "https://exemplo.com/app");
    expect(() => productCallbackUrl()).toThrow("JUDIT_WEBHOOK_PUBLIC_ORIGIN");
    vi.stubEnv("JUDIT_WEBHOOK_PUBLIC_ORIGIN", "http://exemplo.com");
    expect(() => productCallbackUrl()).toThrow("JUDIT_WEBHOOK_PUBLIC_ORIGIN");

    vi.stubEnv("JUDIT_WEBHOOK_PUBLIC_ORIGIN", "https://exemplo.com");
    vi.stubEnv("JUDIT_WEBHOOK_TOKEN", "");
    expect(() => productCallbackUrl()).toThrow("JUDIT_WEBHOOK_TOKEN");
  });
});

describe("fullPayloadEnabled", () => {
  it("is on only with the exact value enabled", () => {
    vi.stubEnv("JUDIT_WEBHOOK_FULL_PAYLOAD", "Enabled");
    expect(fullPayloadEnabled()).toBe(false);

    vi.stubEnv("JUDIT_WEBHOOK_FULL_PAYLOAD", "enabled");
    expect(fullPayloadEnabled()).toBe(true);
  });
});

describe("redactToken", () => {
  it("replaces every occurrence", () => {
    expect(
      redactToken(`a${fakeWebhookToken}b${fakeWebhookToken}`, fakeWebhookToken),
    ).toBe("a[token]b[token]");
  });
});
