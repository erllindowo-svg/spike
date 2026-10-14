import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { serverEnvSchema } from "./env";

// .env.example is the only .env* file that goes to Git (and the repository is
// public). It is the bridge between the code and each person's .env.local, so
// it must list exactly the variables the code reads, and nothing else: no
// values at all. Failure messages show variable names only.
function readEnvExample() {
  const text = readFileSync(new URL("../../.env.example", import.meta.url), {
    encoding: "utf8",
  });

  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"))
    .map((line) => {
      const separator = line.indexOf("=");
      return {
        key: line.slice(0, separator).trim(),
        hasValue: line.slice(separator + 1).trim() !== "",
      };
    });
}

describe(".env.example", () => {
  it("lists exactly the variables validated in src/lib/env.ts", () => {
    const keys = readEnvExample().map((entry) => entry.key);

    expect(keys.toSorted()).toEqual(
      Object.keys(serverEnvSchema.shape).toSorted(),
    );
  });

  it("has no values, only names", () => {
    const filled = readEnvExample()
      .filter((entry) => entry.hasValue)
      .map((entry) => entry.key);

    expect(filled).toEqual([]);
  });
});
