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
  it("accepts the allowlisted test CNPJ, formatted or not", () => {
    expect(() =>
      assertAllowedSearchKey("cnpj", "A1B2C3D4/E5F6-68"),
    ).not.toThrow();
    expect(() =>
      assertAllowedSearchKey("cnpj", "a1b2c3d4e5f668"),
    ).not.toThrow();
  });

  it("rejects an unknown CNPJ", () => {
    expect(() => assertAllowedSearchKey("cnpj", "A1B2C3D4/E5F6-90")).toThrow(
      JuditGuardError,
    );
  });

  it("accepts the allowlisted test CNJ, formatted or not", () => {
    expect(() =>
      assertAllowedSearchKey("lawsuit_cnj", "0000000-39.2026.8.26.0050"),
    ).not.toThrow();
    expect(() =>
      assertAllowedSearchKey("lawsuit_cnj", "00000003920268260050"),
    ).not.toThrow();
  });

  it("rejects an unknown CNJ", () => {
    expect(() =>
      assertAllowedSearchKey("lawsuit_cnj", "0000000-00.0000.0.00.0000"),
    ).toThrow(JuditGuardError);
  });

  it("does not echo the rejected key in the message", () => {
    expect(() => assertAllowedSearchKey("cpf", "999.999.999-99")).toThrow(
      JuditGuardError,
    );
    expect(() => assertAllowedSearchKey("cpf", "999.999.999-99")).not.toThrow(
      /999/,
    );
  });

  it("rejects an empty key", () => {
    expect(() => assertAllowedSearchKey("cnpj", " ./- ")).toThrow(
      JuditGuardError,
    );
  });
});

describe("restricted mode (JUDIT_ALLOWLIST)", () => {
  it("stays on when the variable is empty or has another value", () => {
    vi.stubEnv("JUDIT_ALLOWLIST", "");
    expect(() => assertAllowedSearchKey("cnpj", "11222333000181")).toThrow(
      JuditGuardError,
    );
    vi.stubEnv("JUDIT_ALLOWLIST", "off");
    expect(() => assertAllowedSearchKey("cnpj", "11222333000181")).toThrow(
      JuditGuardError,
    );
  });

  it("lets any key through only with exactly 'disabled'", () => {
    vi.stubEnv("JUDIT_ALLOWLIST", "disabled");
    expect(() =>
      assertAllowedSearchKey("cnpj", "11.222.333/0001-81"),
    ).not.toThrow();
    expect(() => assertAllowedSearchKey("cpf", "000.000.001-91")).not.toThrow();
  });

  it("still rejects an empty key in open mode", () => {
    vi.stubEnv("JUDIT_ALLOWLIST", "disabled");
    expect(() => assertAllowedSearchKey("cnpj", " ./- ")).toThrow(
      JuditGuardError,
    );
  });
});
