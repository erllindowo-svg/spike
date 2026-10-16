import type { Metadata } from "next";
import { connection } from "next/server";

import { billedCallsToday } from "@/features/queries/budget";
import { SettingsPanel } from "@/features/settings/components/settings-panel";
import { describeIntegrations, readEnvFacts } from "@/features/settings/status";

export const metadata: Metadata = { title: "Configurações" };

export default async function SettingsPage() {
  // Lê o ambiente a cada requisição, e não uma vez no build: sem isso, a
  // página mostraria as variáveis da máquina onde o build rodou.
  await connection();
  const facts = readEnvFacts();
  return (
    <SettingsPanel
      integrations={describeIntegrations(facts, await usageToday(facts))}
    />
  );
}

// Chamadas cobradas hoje, para a linha "Proteção de custo". Um banco fora do
// ar não derruba a página: o número só deixa de aparecer.
async function usageToday(
  facts: ReturnType<typeof readEnvFacts>,
): Promise<number | null> {
  if (facts.dataSource !== "db" || !facts.mongoUri) return null;
  try {
    return await billedCallsToday();
  } catch {
    return null;
  }
}
