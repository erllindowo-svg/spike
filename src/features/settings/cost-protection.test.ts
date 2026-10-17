import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { createTestDb } from "@/db/test-db";
import { assertAllowedSearchKey } from "@/lib/judit/guard";
import { JuditGuardError } from "@/lib/judit/errors";

import { getCostProtection, setAllowlist } from "./cost-protection";

// A temporary real MongoDB; the app's getDb() points to it.
const testDb = vi.hoisted(() => ({
  current: undefined as Awaited<ReturnType<typeof createTestDb>> | undefined,
}));
vi.mock("@/db", () => ({ getDb: async () => testDb.current!.db }));

// A fictitious CNPJ outside the allowlist.
const OUTSIDE = "11222333000181";

describe("cost protection switch", () => {
  beforeAll(async () => {
    testDb.current = await createTestDb();
  });
  afterAll(async () => {
    await testDb.current?.close();
  });
  beforeEach(async () => {
    await testDb.current!.reset();
    // Fictitious: getDb() is the temporary server above.
    vi.stubEnv("MONGODB_URI", "mongodb://test.invalid");
  });

  it("follows the variable until the switch is used", async () => {
    expect(await getCostProtection()).toEqual({
      allowlist: true,
      locked: false,
    });
    vi.stubEnv("JUDIT_ALLOWLIST", "disabled");
    expect((await getCostProtection()).allowlist).toBe(false);
  });

  it("the switch decides once used, and the guard follows it", async () => {
    await setAllowlist(false);
    await expect(
      assertAllowedSearchKey("cnpj", OUTSIDE),
    ).resolves.toBeUndefined();

    await setAllowlist(true);
    await expect(assertAllowedSearchKey("cnpj", OUTSIDE)).rejects.toThrow(
      JuditGuardError,
    );
  });

  it("'locked' wins over a switch turned off", async () => {
    await setAllowlist(false);
    vi.stubEnv("JUDIT_ALLOWLIST", "locked");

    expect(await getCostProtection()).toEqual({
      allowlist: true,
      locked: true,
    });
    await expect(assertAllowedSearchKey("cnpj", OUTSIDE)).rejects.toThrow(
      JuditGuardError,
    );
  });
});
