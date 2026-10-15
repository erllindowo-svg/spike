import { describe, expect, it } from "vitest";

import { getTrackingDisplayState, isTrackingClosed } from "./types";

describe("getTrackingDisplayState", () => {
  it("shows our creation cycle before JUDIT's status", () => {
    expect(getTrackingDisplayState({ creation: "pending", status: null })).toBe(
      "not_sent",
    );
    expect(getTrackingDisplayState({ creation: "sending", status: null })).toBe(
      "uncertain",
    );
    expect(
      getTrackingDisplayState({ creation: "uncertain", status: null }),
    ).toBe("uncertain");
    expect(getTrackingDisplayState({ creation: "failed", status: null })).toBe(
      "rejected",
    );
  });

  it("maps JUDIT's raw status once confirmed", () => {
    const confirmed = (status: string) =>
      getTrackingDisplayState({ creation: "confirmed", status });

    expect(confirmed("created")).toBe("pending_first_run");
    expect(confirmed("updated")).toBe("active");
    expect(confirmed("paused")).toBe("paused");
    expect(confirmed("deleted")).toBe("completed");
    // Undocumented values, including names of Object.prototype members.
    expect(confirmed("something_new")).toBe("unknown");
    expect(confirmed("constructor")).toBe("unknown");
  });

  it("treats deleted and refused trackings as closed", () => {
    expect(isTrackingClosed({ creation: "confirmed", status: "deleted" })).toBe(
      true,
    );
    expect(isTrackingClosed({ creation: "failed", status: null })).toBe(true);
    expect(isTrackingClosed({ creation: "uncertain", status: null })).toBe(
      false,
    );
  });
});
