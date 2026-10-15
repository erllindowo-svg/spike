import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { collections } from "@/db/collections";
import { createTestDb } from "@/db/test-db";
import {
  fakeWebhookToken,
  requestCompletedDelivery,
  trackingLawsuitDelivery,
} from "@/lib/judit/__fixtures__/webhooks";

import { listRecentWebhookEvents, saveWebhookEvent } from "./db";
import { prepareWebhookEvent, type NewWebhookEvent } from "./envelope";

// Same setup as trackings/db.test.ts: a temporary real MongoDB with the
// app's indexes replaces getDb().
const testDb = vi.hoisted(() => ({
  current: undefined as Awaited<ReturnType<typeof createTestDb>> | undefined,
}));
vi.mock("@/db", () => ({ getDb: async () => testDb.current!.db }));

function prepared(body: unknown, fullPayload = false): NewWebhookEvent {
  const result = prepareWebhookEvent(body, {
    token: fakeWebhookToken,
    fullPayload,
  });
  if (!result.ok) throw new Error(result.issues.join("; "));
  return result.event;
}

beforeAll(async () => {
  testDb.current = await createTestDb();
}, 120_000);

beforeEach(async () => {
  await testDb.current!.reset();
});

afterAll(async () => {
  await testDb.current?.close();
});

describe("saveWebhookEvent", () => {
  it("stores a delivery as received but not processed", async () => {
    const saved = await saveWebhookEvent(prepared(requestCompletedDelivery));

    expect(saved.duplicate).toBe(false);
    const { webhookEvents } = collections(testDb.current!.db);
    const doc = await webhookEvents.findOne({ _id: saved.event!.id });
    expect(doc).toMatchObject({
      callbackId: "b2f7c86c-0bdc-4f26-a42f-7f4760dba80f",
      referenceType: "request",
      processingStatus: "pending",
      processedAt: null,
      processingError: null,
    });
    expect(JSON.stringify(doc)).not.toContain(fakeWebhookToken);
  });

  it("reports a redelivery (same callback_id) as duplicate, without error", async () => {
    await saveWebhookEvent(prepared(requestCompletedDelivery));
    const again = await saveWebhookEvent(prepared(requestCompletedDelivery));

    expect(again).toEqual({ duplicate: true, event: null });
    const { webhookEvents } = collections(testDb.current!.db);
    expect(await webhookEvents.countDocuments()).toBe(1);
  });

  it("lets two simultaneous redeliveries store only one event", async () => {
    const results = await Promise.all([
      saveWebhookEvent(prepared(requestCompletedDelivery)),
      saveWebhookEvent(prepared(requestCompletedDelivery)),
    ]);

    expect(results.map((result) => result.duplicate).sort()).toEqual([
      false,
      true,
    ]);
  });

  it("does not treat deliveries without callback_id as duplicates", async () => {
    const body = { event_type: "response_created" };
    await saveWebhookEvent(prepared(body));
    const second = await saveWebhookEvent(prepared(body));

    expect(second.duplicate).toBe(false);
  });

  it("stores the documented example with a `$oid` key, even in full mode", async () => {
    const saved = await saveWebhookEvent(
      prepared(trackingLawsuitDelivery, true),
    );

    const { webhookEvents } = collections(testDb.current!.db);
    const doc = await webhookEvents.findOne({ _id: saved.event!.id });
    expect(doc?.payload).toMatchObject({
      _id: { $oid: "65f0efe046ad3bda5b27be2d" },
    });
  });

  it("lets other database errors reach the caller", async () => {
    await testDb.current!.close();
    try {
      await expect(
        saveWebhookEvent(prepared(requestCompletedDelivery)),
      ).rejects.toThrow();
    } finally {
      testDb.current = await createTestDb();
    }
  }, 120_000);
});

describe("listRecentWebhookEvents", () => {
  it("lists the latest deliveries first", async () => {
    // Fixed clock: two saves in a row could share the same millisecond.
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(new Date("2026-10-15T10:00:00Z"));
      await saveWebhookEvent(prepared(requestCompletedDelivery));
      vi.setSystemTime(new Date("2026-10-15T10:00:01Z"));
      await saveWebhookEvent(prepared(trackingLawsuitDelivery));
    } finally {
      vi.useRealTimers();
    }

    const events = await listRecentWebhookEvents(1);

    expect(events).toHaveLength(1);
    expect(events[0].referenceType).toBe("tracking");
  });
});
