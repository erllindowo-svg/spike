import { describe, expect, it } from "vitest";

import { pageWindow } from "./list-pagination";

describe("pageWindow", () => {
  it("cuts the requested page", () => {
    expect(pageWindow(60, 1, 25)).toEqual({
      page: 1,
      pageCount: 3,
      start: 25,
      end: 50,
    });
    expect(pageWindow(60, 2, 25)).toMatchObject({ start: 50, end: 60 });
  });

  it("clamps a page that no longer exists", () => {
    expect(pageWindow(30, 5, 25)).toMatchObject({ page: 1, start: 25 });
    expect(pageWindow(0, 3, 25)).toEqual({
      page: 0,
      pageCount: 1,
      start: 0,
      end: 0,
    });
  });
});
