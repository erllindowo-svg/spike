import { MongoServerError } from "mongodb";

// Código do MongoDB para chave duplicada num índice único
// (https://www.mongodb.com/docs/manual/core/index-unique/).
const DUPLICATE_KEY = 11000;

// Indica se `error` é uma violação do índice único informado. O nome do
// índice é conferido para não confundir com a violação de outra regra de
// unicidade. O servidor só informa o nome dentro da mensagem
// ("E11000 duplicate key error collection: <db>.<col> index: <nome> dup key").
export function isDuplicateKeyError(error: unknown, index: string): boolean {
  return (
    error instanceof MongoServerError &&
    error.code === DUPLICATE_KEY &&
    error.message.includes(`index: ${index} `)
  );
}
