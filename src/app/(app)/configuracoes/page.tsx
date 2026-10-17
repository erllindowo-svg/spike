import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import { PageSkeleton } from "@/components/shared/page-skeleton";

import { billedCallsToday } from "@/features/queries/budget";
import { SettingsPanel } from "@/features/settings/components/settings-panel";
import { getCostProtection } from "@/features/settings/cost-protection";
import { describeIntegrations, readEnvFacts } from "@/features/settings/status";

export const metadata: Metadata = { title: "Configurações" };

// Dentro do Suspense pelo mesmo motivo do Dashboard (catálogo do diário, D5).
export default function SettingsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <SettingsContent />
    </Suspense>
  );
}

async function SettingsContent() {
  // Lê o ambiente a cada requisição, e não uma vez no build: sem isso, a
  // página mostraria as variáveis da máquina onde o build rodou.
  await connection();
  const protection = await getCostProtection();
  const facts = { ...readEnvFacts(), allowlist: protection.allowlist };
  return (
    <SettingsPanel
      integrations={describeIntegrations(facts, await usageToday(facts))}
      costProtection={protection}
    />
  );
}

// Chamadas cobradas hoje, para a linha "Proteção de custo". Um banco fora do
// ar não derruba a página: o número só deixa de aparecer.
async function usageToday(
  facts: ReturnType<typeof readEnvFacts>,
): Promise<number | null> {
  if (!facts.mongoUri) return null;
  try {
    return await billedCallsToday();
  } catch {
    return null;
  }
}
