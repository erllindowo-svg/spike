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
});

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
