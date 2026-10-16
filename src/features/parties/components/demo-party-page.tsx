"use client";

import { SearchXIcon } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { useDemoStore } from "@/lib/demo-store";
import { lowerFirst } from "@/lib/format";

import { DOCUMENTS, normalizeDocument, type DocumentType } from "../documents";
import { PartyDetail } from "./party-detail";

// Só na demonstração: a página de uma parte adicionada nesta aba
// (addDemoParty). O servidor não a conhece, então a página procura no estado
// do navegador. Depois de recarregar, a parte não existe mais.
export function DemoPartyPage({
  documentType,
  document,
  backLink,
}: {
  documentType: DocumentType;
  document: string;
  backLink: React.ReactNode;
}) {
  const { parties } = useDemoStore();
  const normalized = normalizeDocument(documentType, document);
  const party = parties.find(
    (p) => p.documentType === documentType && p.document === normalized,
  );
  const info = DOCUMENTS[documentType];

  if (!party) {
    return (
      <EmptyState
        icon={SearchXIcon}
        title="Registro não encontrado"
        description={`Este ${info.label} não está nos dados de demonstração. Partes adicionadas na demonstração ficam só na aba e somem ao recarregar a página.`}
        action={
          <Button nativeButton={false} render={<Link href={info.basePath} />}>
            Voltar para {lowerFirst(info.partyLabelPlural)}
          </Button>
        }
        className="rounded-xl border bg-card"
      />
    );
  }

  return (
    <>
      {backLink}
      <PartyDetail
        party={party}
        lawsuits={[]}
        asyncQueries={[]}
        distribution={{ area: [], tribunal: [] }}
      />
    </>
  );
}
