import "server-only";

import { z } from "zod";

import { juditRequest } from "./client";

// Account reads: what the key's account has left. No search key, so the
// allowlist does not apply; the kill switch and the pace limit do. The docs
// do not say whether these reads are billed, so the app only runs them on an
// explicit click.

// GET /credits/balance (prepaid accounts):
// https://docs.judit.io/resource/consumption/credits
// The page shows the URL and request examples but no response example or
// field list (README item 45). The schema keeps whatever comes back.
const creditBalanceSchema = z.looseObject({});

export async function getCreditBalance() {
  return juditRequest({
    service: "users",
    method: "GET",
    path: "/credits/balance",
    schema: creditBalanceSchema,
  });
}

// GET /billing/consumption: the current billing cycle. Needs an
// administrative key; integration keys get no billing data.
// https://docs.judit.io/resource/consumption/current
const billingConsumptionSchema = z.looseObject({
  company_id: z.string().optional(),
  consumption: z.number().optional(),
  // The effective cap, extra postpaid credits included.
  max_consumption: z.number().optional(),
  remaining: z.number().optional(),
  cycle_started_at: z.string().optional(),
  cycle_ended_at: z.string().optional(),
});

export type BillingConsumption = z.infer<typeof billingConsumptionSchema>;

export async function getBillingConsumption() {
  return juditRequest({
    service: "requests",
    method: "GET",
    path: "/billing/consumption",
    schema: billingConsumptionSchema,
  });
}
