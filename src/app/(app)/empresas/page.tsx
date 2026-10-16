import type { Metadata } from "next";

import { PartiesListPage } from "@/features/parties/components/party-pages";

export const metadata: Metadata = { title: "Empresas" };

export default function CompaniesPage() {
  return <PartiesListPage documentType="cnpj" />;
}
