import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

// Carrega .env/.env.local com as mesmas regras do Next.js.
loadEnvConfig(process.cwd());

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  // Necessário apenas para db:migrate e db:studio; db:generate funciona sem banco.
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
  strict: true,
  verbose: true,
});
