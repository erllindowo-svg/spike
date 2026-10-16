import type { Metadata } from "next";

import { PartyPage } from "@/features/parties/components/party-pages";
import { getPartyByDocument, staticParamSamples } from "@/lib/data";

export function generateStaticParams() {
  return staticParamSamples.companies();
}

export async function generateMetadata({
  params,
}: PageProps<"/empresas/[cnpj]">): Promise<Metadata> {
  const party = await getPartyByDocument("cnpj", (await params).cnpj);
  return { title: party?.name ?? "Empresa" };
}

export default function CompanyPage({ params }: PageProps<"/empresas/[cnpj]">) {
  return (
    <PartyPage
      documentType="cnpj"
      document={params.then((value) => value.cnpj)}
    />
  );
}
