import { describe, expect, it } from "vitest";

import {
  fakeWebhookToken,
  requestCompletedDelivery,
  trackingLawsuitDelivery,
  trackingPausedDelivery,
} from "@/lib/judit/__fixtures__/webhooks";

import { readDelivery } from "./delivery";
import { prepareWebhookEvent } from "./envelope";

// readDelivery reads the STORED payload, so the lawsuit example goes through
// prepareWebhookEvent first (its response_data becomes a summary).
function stored(body: unknown) {
  const result = prepareWebhookEvent(body, {
    token: fakeWebhookToken,
    fullPayload: false,
  });
  if (!result.ok) throw new Error(result.issues.join("; "));
  return result.event.payload;
}

describe("readDelivery", () => {
  it("reads the end of a request's flow (code 600)", () => {
    expect(readDelivery(stored(requestCompletedDelivery))).toEqual({
      kind: "request_completed",
    });
  });

  it("reads an automatic tracking pause with its code", () => {
    expect(readDelivery(stored(trackingPausedDelivery))).toEqual({
      kind: "tracking_paused",
      code: 700,
    });
  });

  it("keeps the CNJ of a lawsuit from the reduced payload, digits only", () => {
    expect(readDelivery(stored(trackingLawsuitDelivery))).toEqual({
      kind: "lawsuit",
      cnj: "30001331220258190001",
    });
  });

  it("reads an application_error with code and message", () => {
    const body = {
      payload: {
        response_type: "application_error",
        response_data: { code: "LAWSUIT_NOT_FOUND", message: "not found" },
      },
    };
    expect(readDelivery(body)).toEqual({
      kind: "application_error",
      code: "LAWSUIT_NOT_FOUND",
      message: "not found",
    });
  });

  it("does not guess the meaning of undocumented info codes", () => {
    const body = {
      payload: {
        response_type: "application_info",
        response_data: { code: 650 },
      },
    };
    expect(readDelivery(body)).toEqual({ kind: "other_info", code: "650" });
  });

  it("tolerates a delivery without payload", () => {
    expect(readDelivery({ callback_id: "x" })).toEqual({
      kind: "other",
      responseType: null,
    });
    expect(readDelivery(null)).toEqual({ kind: "other", responseType: null });
  });

  it("reads a lawsuit without code as a lawsuit with no CNJ", () => {
    const body = { payload: { response_type: "lawsuit", response_data: {} } };
    expect(readDelivery(body)).toEqual({ kind: "lawsuit", cnj: null });
  });
});
