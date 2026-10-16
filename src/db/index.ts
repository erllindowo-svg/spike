import "server-only";

import { MongoClient, type Db } from "mongodb";

import { getServerEnv } from "@/lib/env";

import { ensureIndexes } from "./collections";
import { migrateCompaniesToParties } from "./migrations";

async function connect(): Promise<Db> {
  const client = new MongoClient(getServerEnv("MONGODB_URI"));
  await client.connect();
  const db = client.db(getServerEnv("MONGODB_DB"));
  // Dados primeiro, índices depois: o índice único de partes já encontra
  // as empresas migradas.
  await migrateCompaniesToParties(db);
  await ensureIndexes(db);
  return db;
}

// Reaproveita a conexão entre recargas do servidor de desenvolvimento e entre
// requisições na mesma instância. Guarda a Promise, e não o resultado, para
// que chamadas simultâneas na partida compartilhem uma única conexão. Se a
// conexão falhar, a Promise é descartada e a próxima chamada tenta de novo.
const globalForDb = globalThis as unknown as { db?: Promise<Db> };

export function getDb(): Promise<Db> {
  globalForDb.db ??= connect().catch((error: unknown) => {
    globalForDb.db = undefined;
    throw error;
  });
  return globalForDb.db;
}
