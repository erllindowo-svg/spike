import { ChevronLeftIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { PageSkeleton } from "@/components/shared/page-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { summarizeDistribution } from "@/features/processes/types";
import { getPartyByDocument, listAsyncQueries, listLawsuits } from "@/lib/data";

import { DOCUMENTS, type DocumentType } from "../documents";
import { PartiesList, type PartyLawsuitSummary } from "./parties-list";
import { PartiesSectionTabs } from "./parties-section-tabs";
import { PartyDetail } from "./party-detail";

// As rotas /empresas e /pessoas usam estas mesmas páginas, cada uma com o
// seu tipo de documento (server components: leem os dados e entregam aos
// componentes de cliente).

export async function PartiesListPage({
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

  return (
    <>
      <PartiesSectionTabs />
      {/* A busca inicial vem de ?q=, lida no cliente. */}
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <PartiesList documentType={documentType} lawsuitSummary={summary} />
      </Suspense>
    </>
  );
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
  const party = await getPartyByDocument(documentType, await document);
  if (!party) notFound();

  const [lawsuits, asyncQueries] = await Promise.all([
    listLawsuits({ partyId: party.id }),
    listAsyncQueries(party.id),
  ]);
  const info = DOCUMENTS[documentType];

  return (
    <>
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
