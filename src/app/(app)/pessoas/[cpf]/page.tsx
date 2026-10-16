import type { Metadata } from "next";

import { PartyPage } from "@/features/parties/components/party-pages";
import { staticParamSamples } from "@/lib/data";

export function generateStaticParams() {
  return staticParamSamples.people();
}

// O título não leva o nome nem o CPF: a aba do navegador e o histórico não
// são lugar para dado pessoal.
export const metadata: Metadata = { title: "Pessoa física" };

export default function PersonPage({ params }: PageProps<"/pessoas/[cpf]">) {
  return (
    <PartyPage
      documentType="cpf"
      document={params.then((value) => value.cpf)}
    />
  );
}
