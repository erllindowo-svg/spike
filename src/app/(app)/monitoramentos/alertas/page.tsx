import type { Metadata } from "next";
import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { AlertsCenter } from "@/features/alerts/components/alerts-center";

export const metadata: Metadata = { title: "Alertas" };

export default function AlertsPage() {
  return (
    // O filtro por monitoramento fica na URL (?monitoramento=).
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
      <AlertsCenter />
    </Suspense>
  );
}
