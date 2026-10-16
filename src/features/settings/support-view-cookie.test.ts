import { describe, expect, it } from "vitest";

import {
  supportViewCookieValue,
  supportViewFromCookieHeader,
} from "./support-view-cookie";

describe("supportViewFromCookieHeader", () => {
  it("is on only with the exact value", () => {
    expect(supportViewFromCookieHeader("a=1; raio-x-vista-suporte=on")).toBe(
      true,
    );
    expect(supportViewFromCookieHeader("raio-x-vista-suporte=off")).toBe(false);
    expect(supportViewFromCookieHeader("x-raio-x-vista-suporte=on")).toBe(
      false,
    );
    expect(supportViewFromCookieHeader("")).toBe(false);
  });
});

describe("supportViewCookieValue", () => {
  it("sets for a year and clears with max-age=0", () => {
    expect(supportViewCookieValue(true)).toContain(
      "raio-x-vista-suporte=on; path=/; max-age=31536000",
    );
    expect(supportViewCookieValue(false)).toContain("max-age=0");
  });
});
