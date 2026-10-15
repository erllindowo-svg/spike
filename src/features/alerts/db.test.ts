import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { createTestDb } from "@/db/test-db";

import {
  createAlert,
  listAlerts,
  markAlertRead,
  markAllAlertsRead,
  type NewAlert,
} from "./db";

// Same setup as the other db tests: a temporary real MongoDB with the app's
// indexes replaces getDb().
const testDb = vi.hoisted(() => ({
  current: undefined as Awaited<ReturnType<typeof createTestDb>> | undefined,
}));
vi.mock("@/db", () => ({ getDb: async () => testDb.current!.db }));

function alert(dedupeKey: string): NewAlert {
  return {
    companyId: null,
    webhookEventId: null,
    trackingId: null,
    lawsuitCnj: null,
    dedupeKey,
    type: "tracking_notice",
    title: "Fictitious alert",
    description: null,
  };
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

describe("createAlert", () => {
  it("refuses a second alert with the same dedupeKey, without error", async () => {
    const first = await createAlert(alert("k1"));
    const again = await createAlert(alert("k1"));

    expect(first.created).toBe(true);
    expect(again).toEqual({ created: false, alert: null });
    expect(await listAlerts()).toHaveLength(1);
  });

  it("lets two simultaneous creations store only one alert", async () => {
    const results = await Promise.all([
      createAlert(alert("k1")),
      createAlert(alert("k1")),
    ]);

    expect(results.map((result) => result.created).sort()).toEqual([
      false,
      true,
    ]);
  });
});

describe("markAlertRead", () => {
  it("keeps the date of the first reading", async () => {
    const { alert: created } = await createAlert(alert("k1"));

    expect(await markAlertRead(created!.id)).toBe(true);
    const [afterFirst] = await listAlerts();
    expect(await markAlertRead(created!.id)).toBe(false);
    const [afterSecond] = await listAlerts();

    expect(afterFirst.readAt).toBeInstanceOf(Date);
    expect(afterSecond.readAt).toEqual(afterFirst.readAt);
  });

  it("marks every unread alert at once", async () => {
    await createAlert(alert("k1"));
    await createAlert(alert("k2"));

    expect(await markAllAlertsRead()).toBe(2);
    expect((await listAlerts()).every((a) => a.readAt)).toBe(true);
  });
});
