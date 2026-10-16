import { ChevronLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { PageSkeleton } from "@/components/shared/page-skeleton";
import { DOCUMENTS, partyHref } from "@/features/parties/documents";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCnj } from "@/features/processes/cnj";
import {
  LawsuitDetails,
  LawsuitTrackingAction,
} from "@/features/processes/components/lawsuit-details";
import { getLawsuitByCnj, listParties, staticParamSamples } from "@/lib/data";

export function generateStaticParams() {
  return staticParamSamples.lawsuits();
}

export async function generateMetadata({
  params,
}: PageProps<"/processos/[cnj]">): Promise<Metadata> {
  const lawsuit = await getLawsuitByCnj((await params).cnj);
  return { title: lawsuit ? formatCnj(lawsuit.cnj) : "Processo" };
}

// params é lido dentro do Suspense para que o shell da rota continue estático.
export default function LawsuitPage({ params }: PageProps<"/processos/[cnj]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <LawsuitContent params={params} />
    </Suspense>
  );
}

async function LawsuitContent({
  params,
}: Pick<PageProps<"/processos/[cnj]">, "params">) {
  const lawsuit = await getLawsuitByCnj((await params).cnj);
  if (!lawsuit) notFound();
  const back = (await listParties()).find((c) => c.id === lawsuit.partyId);

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 w-fit text-muted-foreground"
        nativeButton={false}
        render={
          <Link
            href={
              back
                ? partyHref(back.documentType, back.document)
                : "/monitoramentos"
            }
          />
        }
      >
        <ChevronLeftIcon data-icon="inline-start" />
        {back
          ? (back.name ?? DOCUMENTS[back.documentType].partyLabel)
          : "Monitoramentos"}
      </Button>
      <Card className="max-w-4xl">
        <CardHeader className="flex flex-col gap-3 border-b sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">
              Processo · {lawsuit.tribunal}
            </span>
            <CardTitle className="font-mono text-lg">
              {formatCnj(lawsuit.cnj)}
            </CardTitle>
          </div>
          <LawsuitTrackingAction lawsuit={lawsuit} />
        </CardHeader>
        <CardContent>
          <LawsuitDetails lawsuit={lawsuit} />
        </CardContent>
      </Card>
    </>
  );
}
