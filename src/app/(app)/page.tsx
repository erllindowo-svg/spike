import type { Metadata } from "next";
import { Suspense } from "react";

import { PageSkeleton } from "@/components/shared/page-skeleton";
import { OverviewDashboard } from "@/features/overview/components/overview-dashboard";
import { summarizeDistribution } from "@/features/processes/types";
import { getReferenceDate, listLawsuits, listQueries } from "@/lib/data";

export const metadata: Metadata = { title: "Dashboard" };

// Lê o banco dentro do Suspense, para que a navegação entre páginas mostre o
// esqueleto em vez de esperar o banco (catálogo do diário, D5).
export default function DashboardPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}

async function DashboardContent() {
  const [lawsuits, queries, referenceDate] = await Promise.all([
    listLawsuits(),
    listQueries(),
    getReferenceDate(),
  ]);

  return (
    <OverviewDashboard
      queries={queries}
      referenceDate={referenceDate}
      lawsuitsCount={lawsuits.length}
      distribution={{
        area: summarizeDistribution(lawsuits, "area"),
        tribunal: summarizeDistribution(lawsuits, "tribunal"),
      }}
    />
  );
}
