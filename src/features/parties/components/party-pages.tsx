import { ChevronLeftIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { PageSkeleton } from "@/components/shared/page-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { summarizeDistribution } from "@/features/processes/types";
import {
  getDataSource,
  getPartyByDocument,
  listAsyncQueries,
  listLawsuits,
} from "@/lib/data";

import { DOCUMENTS, type DocumentType } from "../documents";
import { DemoPartyPage } from "./demo-party-page";
import { PartiesList, type PartyLawsuitSummary } from "./parties-list";
import { PartiesSectionTabs } from "./parties-section-tabs";
import { PartyDetail } from "./party-detail";

// As rotas /empresas e /pessoas usam estas mesmas páginas, cada uma com o
// seu tipo de documento (server components: leem os dados e entregam aos
// componentes de cliente).

export function PartiesListPage({
  documentType,
}: {
  documentType: DocumentType;
}) {
  return (
    <>
      <PartiesSectionTabs />
      {/* Os processos são lidos dentro do Suspense: a navegação entre
          páginas mostra o esqueleto em vez de esperar o banco (catálogo do
          diário, D5). A busca inicial vem de ?q=, lida no cliente. */}
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <PartiesListContent documentType={documentType} />
      </Suspense>
    </>
  );
}

async function PartiesListContent({
  documentType,
}: {
  documentType: DocumentType;
}) {
  const summary: PartyLawsuitSummary = {};
  for (const lawsuit of await listLawsuits()) {
    if (!lawsuit.partyId) continue;
    const entry = (summary[lawsuit.partyId] ??= { total: 0, active: 0 });
    entry.total += 1;
    if (lawsuit.status === "active") entry.active += 1;
  }
  return <PartiesList documentType={documentType} lawsuitSummary={summary} />;
}

// params é lido dentro do Suspense para que o shell da rota continue
// estático.
export function PartyPage({
  documentType,
  document,
}: {
  documentType: DocumentType;
  document: Promise<string>;
}) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <PartyContent documentType={documentType} document={document} />
    </Suspense>
  );
}

async function PartyContent({
  documentType,
  document,
}: {
  documentType: DocumentType;
  document: Promise<string>;
}) {
  const value = await document;
  const party = await getPartyByDocument(documentType, value);
  const info = DOCUMENTS[documentType];
  const backLink = (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-2 w-fit text-muted-foreground"
      nativeButton={false}
      render={<Link href={info.basePath} />}
    >
      <ChevronLeftIcon data-icon="inline-start" />
      {info.partyLabelPlural}
    </Button>
  );

  if (!party) {
    // Na demonstração, a parte pode ter sido adicionada nesta aba.
    if (getDataSource() === "demo") {
      return (
        <DemoPartyPage
          documentType={documentType}
          document={value}
          backLink={backLink}
        />
      );
    }
    notFound();
  }

  const [lawsuits, asyncQueries] = await Promise.all([
    listLawsuits({ partyId: party.id }),
    listAsyncQueries(party.id),
  ]);

  return (
    <>
      {backLink}
      <PartyDetail
        party={party}
        lawsuits={lawsuits}
        asyncQueries={asyncQueries}
        distribution={{
          area: summarizeDistribution(lawsuits, "area"),
          tribunal: summarizeDistribution(lawsuits, "tribunal"),
        }}
      />
    </>
  );
}
