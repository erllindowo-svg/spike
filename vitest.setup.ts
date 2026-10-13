import { beforeEach, vi } from "vitest";

// Tests must never reach JUDIT. Every test starts with a fake key, the kill
// switch off and a fetch that fails loudly; tests that need a response
// replace fetch with their own mock.
beforeEach(() => {
  vi.stubEnv("JUDIT_API_KEY", "test-key-never-real");
  vi.stubEnv("JUDIT_LIVE_CALLS", "");
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("Real network access is disabled in tests.");
    }),
  );
});
