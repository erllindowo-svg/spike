import "server-only";

import { z } from "zod";

// Variables are read on demand: the build does not depend on credentials and
// each module only requires what it actually uses. Values never go into
// error messages.
const serverEnvSchema = z.object({
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
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
