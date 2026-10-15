import { describe, expect, it } from "vitest";

import {
  fakeWebhookToken,
  requestCompletedDelivery,
  trackingLawsuitDelivery,
  trackingPausedDelivery,
} from "@/lib/judit/__fixtures__/webhooks";

import { prepareWebhookEvent } from "./envelope";

const defaults = { token: fakeWebhookToken, fullPayload: false };

function prepareOk(body: unknown, options = defaults) {
  const result = prepareWebhookEvent(body, options);
  if (!result.ok) throw new Error(`unexpected: ${result.issues.join("; ")}`);
  return result;
}

describe("prepareWebhookEvent", () => {
  it("reads the documented envelope fields into the event", () => {
    const { event, responseType } = prepareOk(requestCompletedDelivery);

    expect(event).toMatchObject({
      callbackId: "b2f7c86c-0bdc-4f26-a42f-7f4760dba80f",
      eventType: "response_created",
      referenceType: "request",
      referenceId: "ec545a1e-c0ac-47cf-a3df-3668f1bdde11",
    });
    expect(responseType).toBe("application_info");
  });

  it("masks the token that JUDIT echoes back in payload.tags.callback_url", () => {
    const { event } = prepareOk(requestCompletedDelivery);
    const stored = JSON.stringify(event.payload);

    expect(stored).not.toContain(fakeWebhookToken);
    expect(event.payload).toMatchObject({
      payload: {
        tags: {
          callback_url:
            "https://exemplo.trycloudflare.com/api/webhooks/judit?token=[token]",
        },
      },
    });
  });

  it("keeps application_info whole: it has no lawsuit data", () => {
    const { event } = prepareOk(trackingPausedDelivery);

    expect(event.payload).toEqual(trackingPausedDelivery);
  });

  it("replaces lawsuit data with a summary without values by default", () => {
    const { event } = prepareOk(trackingLawsuitDelivery);
    const stored = event.payload as typeof trackingLawsuitDelivery;

    expect(stored.payload.response_data).toEqual({
      omitted: true,
      code: "3000133-12.2025.8.19.0001",
      keys: [
        "amount",
        "code",
        "instance",
        "justice",
        "parties",
        "tribunal",
        "tribunal_acronym",
      ],
    });
    expect(JSON.stringify(stored)).not.toContain("USUÁRIO EXEMPLO 2");
    // The rest of the envelope stays, unknown fields included.
    expect(stored.payload.response_id).toBe(
      "12576767-d3ea-4ea2-8805-6f2a73ef3439",
    );
    expect(stored).toMatchObject({
      _id: { $oid: "65f0efe046ad3bda5b27be2d" },
      webhook_id: "2f82201d-1439-436d-8c6a-2e6b3e36a54f",
    });
  });

  it("stores everything in maintenance mode, still masking the token", () => {
    const body = {
      ...trackingLawsuitDelivery,
      payload: {
        ...trackingLawsuitDelivery.payload,
        tags: { callback_url: `https://x.example/?token=${fakeWebhookToken}` },
      },
    };
    const { event } = prepareOk(body, { ...defaults, fullPayload: true });

    expect(JSON.stringify(event.payload)).toContain("USUÁRIO EXEMPLO 2");
    expect(JSON.stringify(event.payload)).not.toContain(fakeWebhookToken);
  });

  it("accepts an envelope with missing fields and records nulls", () => {
    const { event } = prepareOk({ event_type: "response_created" });

    expect(event).toEqual({
      callbackId: null,
      eventType: "response_created",
      referenceType: null,
      referenceId: null,
      payload: { event_type: "response_created" },
    });
  });

  it.each([
    ["a list", [requestCompletedDelivery]],
    [
      "a number as callback_id",
      { ...requestCompletedDelivery, callback_id: 7 },
    ],
    ["a text as payload", { ...requestCompletedDelivery, payload: "x" }],
    ["null", null],
  ])("refuses %s, which would mean a contract change", (_, body) => {
    const result = prepareWebhookEvent(body, defaults);

    expect(result.ok).toBe(false);
  });
});
