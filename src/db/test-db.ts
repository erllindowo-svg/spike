import { MongoClient } from "mongodb";
import { MongoMemoryServer } from "mongodb-memory-server";

import { collections, ensureIndexes } from "./collections";

// MongoDB de verdade para os testes: o mongodb-memory-server baixa o binário
// oficial do `mongod` na primeira execução (fica em cache) e sobe um servidor
// temporário, sem dados em disco. Os índices são criados pela mesma
// ensureIndexes da aplicação, então os testes exercitam as mesmas regras de
// unicidade. Só para testes: a aplicação conecta pelo MONGODB_URI.
export async function createTestDb() {
  const server = await MongoMemoryServer.create();
  const client = await MongoClient.connect(server.getUri());
  const db = client.db("raio_x_test");
  await ensureIndexes(db);

  return {
    db,
    // Esvazia as coleções entre um teste e outro, mantendo os índices.
    reset: () =>
      Promise.all(
        Object.values(collections(db)).map((collection) =>
          collection.deleteMany({}),
        ),
      ),
    close: async () => {
      await client.close();
      await server.stop();
    },
  };
}
