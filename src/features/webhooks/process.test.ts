import { randomUUID } from "node:crypto";

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
import type { TrackingMode } from "@/db/models";
import { createTestDb } from "@/db/test-db";
import {
  fakeWebhookToken,
  requestCompletedDelivery,
  trackingLawsuitDelivery,
  trackingPausedDelivery,
} from "@/lib/judit/__fixtures__/webhooks";

import { claimWebhookEvent, saveWebhookEvent, STALE_PROCESSING_MS } from "./db";
import { prepareWebhookEvent } from "./envelope";
import { processWebhookEvent } from "./process";

// Same setup as db.test.ts: a temporary real MongoDB with the app's indexes
// replaces getDb(), so the unique indexes behind idempotency are the real
// ones.
const testDb = vi.hoisted(() => ({
  current: undefined as Awaited<ReturnType<typeof createTestDb>> | undefined,
}));
vi.mock("@/db", () => ({ getDb: async () => testDb.current!.db }));

// createAlert can be told to fail once, to simulate a database failure in
// the middle of the rules.
const alertFailure = vi.hoisted(() => ({ next: false }));
vi.mock("@/features/alerts/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/alerts/db")>();
  return {
    ...actual,
    createAlert: async (input: Parameters<typeof actual.createAlert>[0]) => {
      if (alertFailure.next) {
        alertFailure.next = false;
        throw new Error("write concern timeout");
      }
      return actual.createAlert(input);
    },
  };
});

const info = vi.spyOn(console, "info").mockImplementation(() => {});

// Outbound events (src/features/notifications/outbound.ts) published so far.
const outboundLogs = () =>
  info.mock.calls.filter(([message]) =>
    String(message).startsWith("[outbound]"),
  );

// Fictitious identifiers. The reference ids come from the fixtures.
const CNPJ = "A1B2C3D4E5F668";
const CNJ = "00012340320268260100";
const COMPANY_ID = "c0000000-0000-4000-8000-000000000001";
const REQUEST_ID = requestCompletedDelivery.reference_id;
const TRACKING_ID = trackingLawsuitDelivery.reference_id;
const LAWSUIT_CNJ = "30001331220258190001";

const db = () => collections(testDb.current!.db);

async function seedRequest(requestId = REQUEST_ID) {
  const now = new Date("2026-10-15T12:00:00Z");
  await db().juditRequests.insertOne({
    _id: randomUUID(),
    requestId,
    companyId: COMPANY_ID,
    mode: "historical_async",
    delivery: "webhook",
    searchType: "cnpj",
    searchKey: CNPJ,
    cacheTtlInDays: null,
    status: "pending",
    createdAt: now,
    updatedAt: now,
    lastCheckedAt: null,
  });
}

async function seedTracking(mode: TrackingMode = "tracking_document") {
  const now = new Date("2026-10-15T12:00:00Z");
  const id = randomUUID();
  const byCnj = mode === "tracking_lawsuit";
  await db().trackings.insertOne({
    _id: id,
    juditTrackingId: TRACKING_ID,
    companyId: byCnj ? null : COMPANY_ID,
    mode,
    searchType: byCnj ? "cnj" : "cnpj",
    searchKey: byCnj ? CNJ : CNPJ,
    creation: "confirmed",
    creationError: null,
    status: "updated",
    recurrenceDays: 30,
    hourRange: 6,
    delivery: "webhook",
    createdAt: now,
    updatedAt: now,
    lastCheckedAt: null,
    active: true,
  });
  return id;
}

// Stores a delivery the way the route does and returns the event id. Each
// call gets a new callback_id unless one is given: for JUDIT, a new
// delivery.
async function receive(body: Record<string, unknown>, callbackId?: string) {
  const prepared = prepareWebhookEvent(
    { ...body, callback_id: callbackId ?? randomUUID() },
    { token: fakeWebhookToken, fullPayload: false },
  );
  if (!prepared.ok) throw new Error(prepared.issues.join("; "));
  const saved = await saveWebhookEvent(prepared.event);
  return saved.event!.id;
}

const getEvent = (id: string) => db().webhookEvents.findOne({ _id: id });
const allAlerts = () => db().alerts.find().toArray();

function applicationError(referenceType: string, referenceId: string) {
  return {
    event_type: "response_created",
    reference_type: referenceType,
    reference_id: referenceId,
    payload: {
      response_type: "application_error",
      response_data: { code: "LAWSUIT_NOT_FOUND", message: "Not found" },
    },
  };
}

beforeAll(async () => {
  testDb.current = await createTestDb();
}, 120_000);

beforeEach(async () => {
  await testDb.current!.reset();
  alertFailure.next = false;
});

afterAll(async () => {
  await testDb.current?.close();
});

describe("processWebhookEvent: requests", () => {
  it("marks the request completed on code 600, without an alert", async () => {
    await seedRequest();
    const id = await receive(requestCompletedDelivery);

    const result = await processWebhookEvent(id);

    expect(result).toMatchObject({ status: "processed" });
    const request = await db().juditRequests.findOne({ requestId: REQUEST_ID });
    expect(request).toMatchObject({ status: "completed", lastCheckedAt: null });
    expect(await getEvent(id)).toMatchObject({
      processingStatus: "processed",
      processingNote: expect.stringContaining("600"),
      processingError: null,
    });
    expect(await allAlerts()).toHaveLength(0);
  });

  it("records an application_error without changing the request status", async () => {
    await seedRequest();
    const id = await receive(applicationError("request", REQUEST_ID));

    await processWebhookEvent(id);

    const request = await db().juditRequests.findOne({ requestId: REQUEST_ID });
    expect(request?.status).toBe("pending");
    expect((await getEvent(id))?.processingNote).toContain("LAWSUIT_NOT_FOUND");
  });

  it("ignores a request the app does not know, and processes it once it is stored", async () => {
    const id = await receive(requestCompletedDelivery);

    expect(await processWebhookEvent(id)).toMatchObject({ status: "ignored" });

    // The delivery arrived before the app stored the request_id.
    await seedRequest();
    expect(await processWebhookEvent(id)).toMatchObject({
      status: "processed",
    });
  });
});

describe("processWebhookEvent: trackings", () => {
  it("creates one new_lawsuit alert per lawsuit for a document tracking", async () => {
    const trackingId = await seedTracking("tracking_document");
    const cached = await receive(trackingLawsuitDelivery);
    const updated = await receive(trackingLawsuitDelivery);

    await processWebhookEvent(cached);
    await processWebhookEvent(updated);

    const alerts = await allAlerts();
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      type: "new_lawsuit",
      companyId: COMPANY_ID,
      trackingId,
      webhookEventId: cached,
      lawsuitCnj: LAWSUIT_CNJ,
      readAt: null,
    });
    expect((await getEvent(updated))?.processingNote).toContain("já existia");
  });

  it("publishes the outbound event once per new alert, not for repetitions", async () => {
    await seedTracking("tracking_document");
    const cached = await receive(trackingLawsuitDelivery);
    const updated = await receive(trackingLawsuitDelivery);
    const before = outboundLogs().length;

    await processWebhookEvent(cached);
    await processWebhookEvent(updated);

    const published = outboundLogs().slice(before);
    expect(published).toHaveLength(1);
    const [alert] = await allAlerts();
    expect(String(published[0][0])).toContain(`alert.created ${alert._id}`);
  });

  it("creates one lawsuit_movement alert per delivery for a CNJ tracking", async () => {
    await seedTracking("tracking_lawsuit");
    const first = await receive(trackingLawsuitDelivery);
    const second = await receive(trackingLawsuitDelivery);

    await processWebhookEvent(first);
    await processWebhookEvent(second);

    const alerts = await allAlerts();
    expect(alerts.map((alert) => alert.type)).toEqual([
      "lawsuit_movement",
      "lawsuit_movement",
    ]);
  });

  it("marks the tracking paused and alerts on an automatic pause (700)", async () => {
    const trackingId = await seedTracking();
    const id = await receive(trackingPausedDelivery);

    await processWebhookEvent(id);

    expect(await db().trackings.findOne({ _id: trackingId })).toMatchObject({
      status: "paused",
      active: true,
      lastCheckedAt: null,
    });
    const [alert] = await allAlerts();
    expect(alert).toMatchObject({ type: "tracking_notice", trackingId });
    expect(alert.description).toContain("teto");
  });

  it("alerts on an application_error of a tracking", async () => {
    await seedTracking();
    const id = await receive(applicationError("tracking", TRACKING_ID));

    await processWebhookEvent(id);

    const [alert] = await allAlerts();
    expect(alert).toMatchObject({ type: "tracking_notice" });
    expect(alert.description).toContain("LAWSUIT_NOT_FOUND");
  });

  it("ignores a tracking the app does not know", async () => {
    const id = await receive(trackingLawsuitDelivery);

    expect(await processWebhookEvent(id)).toMatchObject({ status: "ignored" });
    expect(await allAlerts()).toHaveLength(0);
  });
});

describe("processWebhookEvent: idempotency and failures", () => {
  it("does not process an event twice, even when called twice at once", async () => {
    await seedTracking();
    const id = await receive(trackingLawsuitDelivery);

    const results = await Promise.all([
      processWebhookEvent(id),
      processWebhookEvent(id),
    ]);

    expect(results.map((result) => result.status).sort()).toEqual([
      "processed",
      "skipped",
    ]);
    expect(await processWebhookEvent(id)).toEqual({ status: "skipped" });
    expect(await allAlerts()).toHaveLength(1);
  });

  it("marks the event failed when the database fails mid-rules, and reprocessing fixes it", async () => {
    await seedTracking();
    const id = await receive(trackingLawsuitDelivery);
    alertFailure.next = true;

    expect(await processWebhookEvent(id)).toEqual({
      status: "failed",
      error: "write concern timeout",
    });
    expect(await getEvent(id)).toMatchObject({
      processingStatus: "failed",
      processingError: "write concern timeout",
    });

    expect(await processWebhookEvent(id)).toMatchObject({
      status: "processed",
    });
    expect(await allAlerts()).toHaveLength(1);
  });

  it("lets an event stuck in processing be claimed again only after a while", async () => {
    await seedTracking();
    const id = await receive(trackingLawsuitDelivery);
    const start = new Date();
    await claimWebhookEvent(id, start);

    expect(await processWebhookEvent(id)).toEqual({ status: "skipped" });
    const later = new Date(start.getTime() + STALE_PROCESSING_MS + 1000);
    expect(await claimWebhookEvent(id, later)).not.toBeNull();
  });

  it("processes an event stored before stage 6 (without the new fields)", async () => {
    await seedRequest();
    const id = randomUUID();
    await db().webhookEvents.insertOne({
      _id: id,
      callbackId: randomUUID(),
      eventType: "response_created",
      referenceType: "request",
      referenceId: REQUEST_ID,
      payload: requestCompletedDelivery,
      receivedAt: new Date(),
      processingStatus: "pending",
      processedAt: null,
      processingError: null,
    });

    expect(await processWebhookEvent(id)).toMatchObject({
      status: "processed",
    });
  });

  it("ignores a delivery without reference_id", async () => {
    const id = await receive({ event_type: "response_created" });

    expect(await processWebhookEvent(id)).toMatchObject({ status: "ignored" });
  });
});
