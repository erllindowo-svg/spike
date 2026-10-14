import { OverviewDashboard } from "@/features/overview/components/overview-dashboard";
import { summarizeDistribution } from "@/features/processes/types";
import { listLawsuits } from "@/lib/data";

export default async function OverviewPage() {
  const lawsuits = await listLawsuits();

  return (
    <OverviewDashboard
      lawsuitsCount={lawsuits.length}
      activeLawsuitsCount={lawsuits.filter((l) => l.status === "active").length}
      distribution={{
        area: summarizeDistribution(lawsuits, "area"),
        tribunal: summarizeDistribution(lawsuits, "tribunal"),
      }}
    />
  );
}
