import "server-only";

import { z } from "zod";

// Variables are read on demand: the build does not depend on credentials and
// each module only requires what it actually uses. Values never go into
// error messages.
const serverEnvSchema = z.object({
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
