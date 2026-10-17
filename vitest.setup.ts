import { beforeEach, vi } from "vitest";

// O protótipo não tem rede: todo teste começa com um fetch que falha alto,
// para que nada saia da máquina sem querer.
beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("Real network access is disabled in tests.");
    }),
  );
});
