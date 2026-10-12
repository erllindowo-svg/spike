import "server-only";

import { z } from "zod";

// Variáveis lidas sob demanda: o build não depende de credenciais e cada
// módulo só exige o que realmente usa. Os valores nunca entram nas mensagens.
const serverEnvSchema = z.object({
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  JUDIT_API_KEY: z.string().trim().min(1),
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
