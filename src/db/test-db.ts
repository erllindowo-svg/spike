import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

import * as schema from "./schema";

// Banco PostgreSQL de verdade para os testes, rodando dentro do próprio
// processo (PGlite), sem servidor nem rede. As migrations de `drizzle/` são
// aplicadas como seriam no banco real, então os testes exercitam as mesmas
// restrições (UNIQUE, CHECK, chaves estrangeiras). Só para testes: a
// aplicação usa o postgres.js em src/db/index.ts.
export async function createTestDb() {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "drizzle" });

  return {
    db,
    // Esvazia as tabelas entre um teste e outro.
    reset: () =>
      db.execute(
        sql`TRUNCATE alerts, webhook_events, trackings, companies CASCADE`,
      ),
    close: () => client.close(),
  };
}
