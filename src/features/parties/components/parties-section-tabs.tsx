"use client";

import { SectionTabs } from "@/components/layout/section-tabs";
import { useDemoStore } from "@/lib/demo-store";

// Empresas e pessoas físicas lado a lado (escolha R3 do escopo).
export function PartiesSectionTabs() {
  const { parties } = useDemoStore();
  const count = (type: "cnpj" | "cpf") =>
    parties.filter((p) => p.documentType === type).length;

  return (
    <SectionTabs
      tabs={[
        { href: "/empresas", label: "Empresas", badge: count("cnpj") },
        { href: "/pessoas", label: "Pessoas físicas", badge: count("cpf") },
      ]}
    />
  );
}
