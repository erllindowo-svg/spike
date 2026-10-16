import { describe, expect, it, vi } from "vitest";

import { describeIntegrations, readEnvFacts, type EnvFacts } from "./status";

const allSet: EnvFacts = {
  dataSource: "db",
  mongoUri: true,
  apiKey: true,
  liveCalls: true,
  webhookToken: true,
  publicOrigin: true,
};

function statusOf(facts: EnvFacts, id: string) {
  return describeIntegrations(facts).find((item) => item.id === id);
}

describe("describeIntegrations", () => {
  it("shows everything on when every variable is set", () => {
    expect(describeIntegrations(allSet).map((i) => i.tone)).toEqual([
      "success",
      "success",
      "success",
    ]);
  });

  it("marks every integration as unused in demo mode", () => {
    const items = describeIntegrations({ ...allSet, dataSource: "demo" });
    expect(items.map((i) => i.tone)).toEqual(["neutral", "neutral", "neutral"]);
  });

  it("tells a missing key apart from blocked calls", () => {
    expect(statusOf({ ...allSet, apiKey: false }, "judit")?.label).toBe(
      "Não configurada",
    );
    expect(statusOf({ ...allSet, liveCalls: false }, "judit")?.label).toBe(
      "Chamadas bloqueadas",
    );
  });

  it("flags a public origin without a token as incomplete", () => {
    const item = statusOf({ ...allSet, webhookToken: false }, "webhooks");
    expect(item?.tone).toBe("warning");
    expect(item?.label).toBe("Incompleto");
  });

  it("treats a token without a public origin as polling only", () => {
    expect(
      statusOf({ ...allSet, publicOrigin: false }, "webhooks")?.label,
    ).toBe("Só a rota");
  });

  it("flags db mode without a connection string", () => {
    expect(statusOf({ ...allSet, mongoUri: false }, "database")?.tone).toBe(
      "warning",
    );
  });
});

describe("readEnvFacts", () => {
  it("never carries a variable's value", () => {
    const key = "fictitious-key-value-123456";
    const token = "fictitious-webhook-token-0123456789abcdef";
    vi.stubEnv("DATA_SOURCE", "db");
    vi.stubEnv("MONGODB_URI", "mongodb+srv://user:secret@example.invalid");
    vi.stubEnv("JUDIT_API_KEY", key);
    vi.stubEnv("JUDIT_LIVE_CALLS", "enabled");
    vi.stubEnv("JUDIT_WEBHOOK_TOKEN", token);
    vi.stubEnv("JUDIT_WEBHOOK_PUBLIC_ORIGIN", "https://example.invalid");

    const facts = readEnvFacts();
    const shown = JSON.stringify(describeIntegrations(facts));

    expect(facts).toEqual(allSet);
    for (const secret of [key, token, "secret", "example.invalid"]) {
      expect(shown).not.toContain(secret);
    }
  });

  it("reads empty variables as not set", () => {
    vi.stubEnv("DATA_SOURCE", "db");
    vi.stubEnv("MONGODB_URI", "");
    vi.stubEnv("JUDIT_API_KEY", "  ");
    vi.stubEnv("JUDIT_LIVE_CALLS", "yes");
    vi.stubEnv("JUDIT_WEBHOOK_TOKEN", "");
    vi.stubEnv("JUDIT_WEBHOOK_PUBLIC_ORIGIN", "");

    expect(readEnvFacts()).toEqual({
      dataSource: "db",
      mongoUri: false,
      apiKey: false,
      liveCalls: false,
      webhookToken: false,
      publicOrigin: false,
    });
  });
});
