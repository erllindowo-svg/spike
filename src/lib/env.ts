import "server-only";

import { z } from "zod";

// Variables are read on demand: the build does not depend on credentials and
// each module only requires what it actually uses. Values never go into
// error messages. Exported so src/lib/env.test.ts can keep .env.example in
// sync with it.
export const serverEnvSchema = z.object({
  // MongoDB connection string (Atlas gives the mongodb+srv:// form). Checked
  // as a prefix, not as a URL: the mongodb:// form may list several hosts,
  // which a URL parser rejects.
  MONGODB_URI: z
    .string()
    .trim()
    .regex(/^mongodb(\+srv)?:\/\//),
  // Database name inside the cluster. Explicit default so data never lands
  // silently in the driver's fallback database ("test").
  MONGODB_DB: z.string().trim().min(1).default("raio_x"),
  // Where the app reads and writes its data: "demo" (fictitious data in
  // memory, the default) or "db" (MongoDB). See src/lib/data.ts.
  DATA_SOURCE: z.enum(["demo", "db"]).default("demo"),
  JUDIT_API_KEY: z.string().trim().min(1),
  // Kill switch for real JUDIT calls. Optional on purpose: absent means
  // "disabled", and src/lib/judit/guard.ts only accepts the exact value
  // "enabled".
  JUDIT_LIVE_CALLS: z.string().trim().optional(),
  // Restricted mode: searches by document or CNJ only for the keys listed in
  // src/lib/judit/guard.ts. "locked" keeps it on with no switch; otherwise
  // the switch in Configurações decides, starting off only with "disabled"
  // (src/features/settings/cost-protection.ts).
  JUDIT_ALLOWLIST: z.string().trim().optional(),
  // Our own pace limit, below JUDIT's 180 per minute (README item 43).
  // Empty means the default in src/lib/judit/rate-limit.ts.
  JUDIT_MAX_CALLS_PER_MINUTE: emptyAsAbsent(
    z.coerce.number().int().min(1).max(170).optional(),
  ),
  // Daily cap of billable calls, counted in the app's own history.
  // Empty means the default in src/features/queries/budget.ts.
  JUDIT_DAILY_CALL_LIMIT: emptyAsAbsent(
    z.coerce.number().int().min(1).max(10_000).optional(),
  ),
  // Secret that JUDIT sends back in the webhook URL (?token=...): the docs
  // define no signature, so this is how the route tells JUDIT from anyone
  // else. Absent means the webhook route is disabled (404). See
  // src/features/webhooks/callback.ts. An empty line (`JUDIT_WEBHOOK_TOKEN=`,
  // as copied from .env.example) reaches process.env as "", so it is read as
  // absent; otherwise min(32) would fail and the route would answer 503,
  // making JUDIT retry instead of stopping.
  JUDIT_WEBHOOK_TOKEN: z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? undefined : value,
    z.string().trim().min(32).optional(),
  ),
  // Maintenance switch: only the exact value "enabled" stores the whole
  // webhook payload (lawsuit data included) for diagnosis. Off by default.
  JUDIT_WEBHOOK_FULL_PAYLOAD: z.string().trim().optional(),
  // Public https origin where JUDIT can reach this app (in development, the
  // tunnel URL, which changes every time the tunnel starts). When set, the
  // app's async queries send a callback_url and are marked as delivered by
  // webhook; empty means polling only. See src/features/webhooks/callback.ts.
  JUDIT_WEBHOOK_PUBLIC_ORIGIN: z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? undefined : value,
    z
      .string()
      .trim()
      .refine(isHttpsOrigin, "must be an https:// origin")
      .optional(),
  ),
});

// An empty line copied from .env.example reaches process.env as "": read it
// as absent, so the default applies instead of a validation error.
function emptyAsAbsent<T extends z.ZodType>(schema: T) {
  return z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? undefined : value,
    schema,
  );
}

function isHttpsOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.pathname === "/" && !url.search;
  } catch {
    return false;
  }
}

type ServerEnv = z.infer<typeof serverEnvSchema>;

export function getServerEnv<K extends keyof ServerEnv>(key: K): ServerEnv[K] {
  const result = serverEnvSchema.shape[key].safeParse(process.env[key]);

  if (!result.success) {
    throw new Error(
      `Variável de ambiente ${key} ausente ou inválida. Consulte o .env.example.`,
    );
  }

  return result.data as ServerEnv[K];
}

// Whether a variable is set and valid, without handing its value to the
// caller. An empty or absent variable counts as not set, even when the
// schema has a default. Used by the settings page, which shows the state of
// each integration but never a value.
export function hasServerEnv(key: keyof ServerEnv): boolean {
  const value = process.env[key];
  if (value === undefined || value.trim() === "") return false;
  return serverEnvSchema.shape[key].safeParse(value).success;
}
