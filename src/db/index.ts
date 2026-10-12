import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { getServerEnv } from "@/lib/env";

import * as schema from "./schema";

function createDb() {
  const client = postgres(getServerEnv("DATABASE_URL"), {
    // Poolers em modo transação (PgBouncer, Supabase, Neon) não suportam
    // prepared statements de forma consistente.
    prepare: false,
  });

  return drizzle(client, { schema });
}

type Database = ReturnType<typeof createDb>;

// Reaproveita a conexão entre recargas do servidor de desenvolvimento.
const globalForDb = globalThis as unknown as { db?: Database };

export function getDb(): Database {
  globalForDb.db ??= createDb();
  return globalForDb.db;
}
