import type { Metadata } from "next";
import { connection } from "next/server";

import { SettingsPanel } from "@/features/settings/components/settings-panel";
import { describeIntegrations, readEnvFacts } from "@/features/settings/status";

export const metadata: Metadata = { title: "Configurações" };

export default async function SettingsPage() {
  // Lê o ambiente a cada requisição, e não uma vez no build: sem isso, a
  // página mostraria as variáveis da máquina onde o build rodou.
  await connection();
  return <SettingsPanel integrations={describeIntegrations(readEnvFacts())} />;
}
