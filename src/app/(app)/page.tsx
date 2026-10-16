import type { Metadata } from "next";

import { OverviewDashboard } from "@/features/overview/components/overview-dashboard";
import { summarizeDistribution } from "@/features/processes/types";
import { getReferenceDate, listLawsuits, listQueries } from "@/lib/data";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
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
