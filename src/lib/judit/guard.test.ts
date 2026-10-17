import { describe, expect, it, vi } from "vitest";

import { JuditGuardError, JuditLiveCallsDisabledError } from "./errors";
import { assertAllowedSearchKey, assertLiveCallsEnabled } from "./guard";

describe("assertLiveCallsEnabled", () => {
  it("blocks when JUDIT_LIVE_CALLS is empty", () => {
    expect(() => assertLiveCallsEnabled()).toThrow(JuditLiveCallsDisabledError);
  });

  it("blocks values other than exactly 'enabled'", () => {
    vi.stubEnv("JUDIT_LIVE_CALLS", "true");
    expect(() => assertLiveCallsEnabled()).toThrow(JuditLiveCallsDisabledError);
  });

  it("allows 'enabled'", () => {
    vi.stubEnv("JUDIT_LIVE_CALLS", "enabled");
    expect(() => assertLiveCallsEnabled()).not.toThrow();
  });
});

describe("assertAllowedSearchKey", () => {
  it("accepts the allowlisted test CNPJ, formatted or not", async () => {
    await expect(
      assertAllowedSearchKey("cnpj", "A1B2C3D4/E5F6-68"),
    ).resolves.toBeUndefined();
    await expect(
      assertAllowedSearchKey("cnpj", "a1b2c3d4e5f668"),
    ).resolves.toBeUndefined();
  });

  it("rejects an unknown CNPJ", async () => {
    await expect(
      assertAllowedSearchKey("cnpj", "A1B2C3D4/E5F6-90"),
    ).rejects.toThrow(JuditGuardError);
  });

  it("accepts the allowlisted test CNJ, formatted or not", async () => {
    await expect(
      assertAllowedSearchKey("lawsuit_cnj", "0000000-39.2026.8.26.0050"),
    ).resolves.toBeUndefined();
    await expect(
      assertAllowedSearchKey("lawsuit_cnj", "00000003920268260050"),
    ).resolves.toBeUndefined();
  });

  it("rejects an unknown CNJ", async () => {
    await expect(
      assertAllowedSearchKey("lawsuit_cnj", "0000000-00.0000.0.00.0000"),
    ).rejects.toThrow(JuditGuardError);
  });

  it("does not echo the rejected key in the message", async () => {
    await expect(
      assertAllowedSearchKey("cpf", "999.999.999-99"),
    ).rejects.toThrow(JuditGuardError);
    await expect(
      assertAllowedSearchKey("cpf", "999.999.999-99"),
    ).rejects.not.toThrow(/999/);
  });

  it("rejects an empty key", async () => {
    await expect(assertAllowedSearchKey("cnpj", " ./- ")).rejects.toThrow(
      JuditGuardError,
    );
  });
});

describe("restricted mode (JUDIT_ALLOWLIST)", () => {
  it("stays on when the variable is empty or has another value", async () => {
    vi.stubEnv("JUDIT_ALLOWLIST", "");
    await expect(
      assertAllowedSearchKey("cnpj", "11222333000181"),
    ).rejects.toThrow(JuditGuardError);
    vi.stubEnv("JUDIT_ALLOWLIST", "off");
    await expect(
      assertAllowedSearchKey("cnpj", "11222333000181"),
    ).rejects.toThrow(JuditGuardError);
  });

  it("lets any key through only with exactly 'disabled'", async () => {
    vi.stubEnv("JUDIT_ALLOWLIST", "disabled");
    await expect(
      assertAllowedSearchKey("cnpj", "11.222.333/0001-81"),
    ).resolves.toBeUndefined();
    await expect(
      assertAllowedSearchKey("cpf", "000.000.001-91"),
    ).resolves.toBeUndefined();
  });

  it("stays on with 'locked', the server lock", async () => {
    vi.stubEnv("JUDIT_ALLOWLIST", "locked");
    await expect(
      assertAllowedSearchKey("cnpj", "11222333000181"),
    ).rejects.toThrow(JuditGuardError);
  });

  it("still rejects an empty key in open mode", async () => {
    vi.stubEnv("JUDIT_ALLOWLIST", "disabled");
    await expect(assertAllowedSearchKey("cnpj", " ./- ")).rejects.toThrow(
      JuditGuardError,
    );
  });
});
