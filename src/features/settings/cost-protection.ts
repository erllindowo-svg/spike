import "server-only";

import { getDb } from "@/db";
import { collections } from "@/db/collections";
import { getServerEnv, hasServerEnv } from "@/lib/env";

// O interruptor do modo restrito (círculo 5). Quem decide, em ordem:
//
// 1. JUDIT_ALLOWLIST="locked": sempre ligado, e o interruptor some. É a
//    trava do servidor, para publicar o app.
// 2. O interruptor, guardado no banco (`app_settings`), quando alguém já o
//    usou.
// 3. Sem interruptor usado: a variável, como antes ("disabled" desliga;
//    qualquer outro valor liga).
//
// O interruptor só aparece com o modo desenvolvedor (vista de suporte)
// ligado, mas isso é interface: a vista é um cookie que qualquer pessoa
// liga. Quem controla de verdade é a trava (1). O teto diário e o ritmo
// continuam ligados nos dois modos.

export type CostProtection = { allowlist: boolean; locked: boolean };

export function allowlistLocked(): boolean {
  return getServerEnv("JUDIT_ALLOWLIST") === "locked";
}

function envDefault(): boolean {
  return getServerEnv("JUDIT_ALLOWLIST") !== "disabled";
}

export async function getCostProtection(): Promise<CostProtection> {
  if (allowlistLocked()) return { allowlist: true, locked: true };
  // Sem banco configurado (testes, rotas de dev), não há interruptor gravado:
  // vale a variável. O app em si nem abre sem MONGODB_URI (setup-screen.tsx).
  if (!hasServerEnv("MONGODB_URI")) {
    return { allowlist: envDefault(), locked: false };
  }
  try {
    const { appSettings } = collections(await getDb());
    const saved = await appSettings.findOne({ _id: "cost-protection" });
    return { allowlist: saved?.allowlist ?? envDefault(), locked: false };
  } catch (error) {
    // Sem banco, na dúvida, o modo restrito: um erro não pode abrir a porta.
    console.error("[cost] falha ao ler o interruptor; modo restrito", error);
    return { allowlist: true, locked: false };
  }
}

export async function setAllowlist(allowlist: boolean): Promise<void> {
  const { appSettings } = collections(await getDb());
  await appSettings.updateOne(
    { _id: "cost-protection" },
    { $set: { allowlist, updatedAt: new Date() } },
    { upsert: true },
  );
}
