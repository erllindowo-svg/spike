import type { Metadata } from "next";
import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import {
  CompaniesList,
  type CompanyLawsuitSummary,
} from "@/features/companies/components/companies-list";
import { listLawsuits } from "@/lib/data";

export const metadata: Metadata = { title: "Empresas" };

export default function CompaniesPage() {
  const summary: CompanyLawsuitSummary = {};
  for (const lawsuit of listLawsuits()) {
    if (!lawsuit.companyId) continue;
    const entry = (summary[lawsuit.companyId] ??= { total: 0, active: 0 });
    entry.total += 1;
    if (lawsuit.status === "active") entry.active += 1;
  }

  return (
    // A busca inicial vem de ?q=, lida no cliente.
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
      <CompaniesList lawsuitSummary={summary} />
    </Suspense>
  );
}
