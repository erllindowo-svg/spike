import { ChevronLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { PageSkeleton } from "@/components/shared/page-skeleton";
import { Button } from "@/components/ui/button";
import { CompanyDetail } from "@/features/companies/components/company-detail";
import { summarizeDistribution } from "@/features/processes/types";
import { getCompanyByCnpj, listLawsuits, staticParamSamples } from "@/lib/data";

export function generateStaticParams() {
  return staticParamSamples.companies();
}

export async function generateMetadata({
  params,
}: PageProps<"/empresas/[cnpj]">): Promise<Metadata> {
  const company = await getCompanyByCnpj((await params).cnpj);
  return { title: company?.legalName ?? "Empresa" };
}

// params é lido dentro do Suspense para que o shell da rota continue estático.
export default function CompanyPage({ params }: PageProps<"/empresas/[cnpj]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <CompanyContent params={params} />
    </Suspense>
  );
}

async function CompanyContent({
  params,
}: Pick<PageProps<"/empresas/[cnpj]">, "params">) {
  const company = await getCompanyByCnpj((await params).cnpj);
  if (!company) notFound();

  const lawsuits = await listLawsuits({ companyId: company.id });

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 w-fit text-muted-foreground"
        nativeButton={false}
        render={<Link href="/empresas" />}
      >
        <ChevronLeftIcon data-icon="inline-start" />
        Empresas
      </Button>
      <CompanyDetail
        company={company}
        lawsuits={lawsuits}
        distribution={{
          area: summarizeDistribution(lawsuits, "area"),
          tribunal: summarizeDistribution(lawsuits, "tribunal"),
        }}
      />
    </>
  );
}
