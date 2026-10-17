// Mostra o que o Next lê dos arquivos .env, sem expor segredos.
//
//   pnpm env:check        nomes, tamanhos e valores não secretos
//   pnpm env:check --db   também testa a conexão com o MongoDB (ping)
//
// É a forma combinada de inspecionar o ambiente, para a pessoa e para o
// agente: nenhum valor secreto aparece na saída, só o nome, o tamanho e, na
// URI do MongoDB, o formato. Os nomes esperados vêm do .env.example.
import { readFileSync } from "node:fs";

import nextEnv from "@next/env";
import { MongoClient } from "mongodb";

// Valores que podem aparecer na tela porque não são segredos.
const PUBLIC_VALUES = new Set([
  "MONGODB_DB",
  "DATA_SOURCE",
  "JUDIT_LIVE_CALLS",
  "JUDIT_ALLOWLIST",
  "JUDIT_MAX_CALLS_PER_MINUTE",
  "JUDIT_DAILY_CALL_LIMIT",
  "JUDIT_WEBHOOK_FULL_PAYLOAD",
  // URL do túnel: pública por definição (o token não faz parte dela).
  "JUDIT_WEBHOOK_PUBLIC_ORIGIN",
]);

const expectedKeys = readFileSync(".env.example", "utf8")
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => line !== "" && !line.startsWith("#"))
  .map((line) => line.slice(0, line.indexOf("=")).trim());

// Largura da coluna dos nomes: o maior nome mais dois espaços.
const column = Math.max(...expectedKeys.map((key) => key.length)) + 2;

// dev = true: carrega os mesmos arquivos que o `pnpm dev` (.env.local etc.).
// O logger vazio evita que o carregador imprima mensagens próprias.
const silent = { info() {}, error() {} };
const { loadedEnvFiles } = nextEnv.loadEnvConfig(process.cwd(), true, silent);

let failed = false;

console.log(
  "Arquivos carregados:",
  loadedEnvFiles.map((file) => file.path).join(", ") || "nenhum",
);
console.log();

for (const key of expectedKeys) {
  const value = process.env[key];
  let status;

  if (value === undefined || value.trim() === "") {
    status = "vazia ou ausente";
  } else if (PUBLIC_VALUES.has(key)) {
    status = JSON.stringify(value);
  } else if (key === "MONGODB_URI") {
    const format = value.match(/^mongodb(\+srv)?:\/\//)?.[0];
    status = `definida (${value.length} caracteres, formato ${format ?? "INVÁLIDO: deve começar com mongodb+srv:// ou mongodb://"})`;
  } else {
    status = `definida (${value.length} caracteres)`;
  }

  console.log(`${key.padEnd(column)}${status}`);

  if (key === "MONGODB_URI" && value?.trim()) {
    for (const note of uriNotes(value.trim())) {
      console.log(`${"".padEnd(column)}${note}`);
    }
  }
}

// Nomes presentes nos arquivos, mas que o código não lê: quase sempre um erro
// de digitação (ex.: MONGO_URI no lugar de MONGODB_URI).
const unknownKeys = [
  ...new Set(loadedEnvFiles.flatMap((file) => Object.keys(file.env))),
].filter((key) => !expectedKeys.includes(key));

if (unknownKeys.length > 0) {
  failed = true;
  console.log();
  console.log(
    "Nomes que o código não usa (compare com o .env.example):",
    unknownKeys.join(", "),
  );
}

if (process.argv.includes("--db")) {
  console.log();
  failed = (await pingMongo()) === false || failed;
}

process.exitCode = failed ? 1 : 0;

async function pingMongo() {
  const uri = process.env.MONGODB_URI?.trim();
  // Mesmo padrão de src/lib/env.ts.
  const dbName = process.env.MONGODB_DB?.trim() || "raio_x";

  if (!uri) {
    console.log("MongoDB: sem MONGODB_URI, teste não executado.");
    return false;
  }

  // Só leitura: ping e lista de coleções. Não cria índices nem documentos.
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10_000 });

  try {
    await client.connect();
    const db = client.db(dbName);
    await db.command({ ping: 1 });
    const collections = await db
      .listCollections({}, { nameOnly: true })
      .toArray();

    console.log(`MongoDB: conectado, banco "${dbName}" respondeu ao ping.`);
    console.log(
      "Coleções:",
      collections.map((collection) => collection.name).join(", ") ||
        "nenhuma (o app cria na primeira gravação)",
    );
    return true;
  } catch (error) {
    console.log(`MongoDB: falhou (${error.name}).`);
    console.log("Mensagem:", redact(error.message));
    console.log("Pista:", hint(error));
    return false;
  } finally {
    await client.close();
  }
}

// Partes da URI que não são segredo (info) e erros comuns na senha (aviso),
// detectados sem mostrá-la.
function uriNotes(uri) {
  const rest = uri.replace(/^mongodb(\+srv)?:\/\//, "");
  const at = rest.lastIndexOf("@");

  if (at === -1)
    return ["aviso: a URI não tem usuário e senha (usuario:senha@)."];

  const credentials = rest.slice(0, at);
  const colon = credentials.indexOf(":");
  const user = colon === -1 ? credentials : credentials.slice(0, colon);
  const password = colon === -1 ? "" : credentials.slice(colon + 1);
  // Depois do endereço: /banco?opcoes. Sem authSource, um banco no caminho
  // pode mudar onde o usuário é autenticado.
  const afterHost = rest.slice(at + 1).match(/^[^/?]*\/?([^?]*)\??(.*)$/);
  const options = new URLSearchParams(afterHost?.[2] ?? "");

  const notes = [
    `info: usuário "${user}" (deve ser igual ao de Atlas > Database Access).`,
    `info: banco no caminho ${afterHost?.[1] ? `"${afterHost[1]}"` : "nenhum"}; opções: ${[...options.keys()].join(", ") || "nenhuma"}; authSource: ${options.get("authSource") ?? "não definido"}.`,
  ];

  if (password === "") notes.push("aviso: a URI não tem senha.");
  if (/db_password/i.test(credentials)) {
    notes.push(
      "aviso: a URI ainda tem o texto db_password; troque pela senha do usuário do banco.",
    );
  }
  if (/^[<(].*[>)]$/.test(password)) {
    notes.push(
      "aviso: a senha está entre < > ou ( ); apague os sinais e deixe só a senha.",
    );
  } else if (/[<>]/.test(credentials)) {
    notes.push(
      "aviso: o usuário ou a senha têm o sinal < ou >; confira se sobrou parte do marcador do Atlas.",
    );
  }
  if (/[@:/?#[\]]/.test(password) || /%(?![0-9A-Fa-f]{2})/.test(password)) {
    notes.push(
      "aviso: a senha tem caracteres especiais sem codificação; use uma senha só com letras e números.",
    );
  }
  return notes;
}

// Mensagens do driver podem citar a URI ou o endereço do cluster.
function redact(text) {
  return text
    .replace(/mongodb(\+srv)?:\/\/\S+/g, "<MONGODB_URI>")
    .replace(/[\w.-]+\.mongodb\.net/g, "<cluster>.mongodb.net");
}

function hint(error) {
  if (error.code === 18 || /auth/i.test(error.message)) {
    return "usuário ou senha do banco recusados (Atlas > Database Access).";
  }
  if (error.name === "MongoServerSelectionError") {
    return "servidor não alcançado: o IP atual está liberado em Atlas > Network Access?";
  }
  if (error.name === "MongoParseError" || error.name === "MongoAPIError") {
    return "URI malformada: senha com caractere especial precisa ser codificada.";
  }
  return "sem pista conhecida; leia a mensagem acima.";
}
