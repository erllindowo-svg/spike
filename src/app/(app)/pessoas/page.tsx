import type { Metadata } from "next";

import { PartiesListPage } from "@/features/parties/components/party-pages";

export const metadata: Metadata = { title: "Pessoas físicas" };

export default function PeoplePage() {
  return <PartiesListPage documentType="cpf" />;
}
