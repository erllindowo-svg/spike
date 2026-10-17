import type { Metadata } from "next";
import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { SupportViewGate } from "@/features/settings/support-view";
import { WebhookDiagnostics } from "@/features/webhooks/components/webhook-diagnostics";

export const metadata: Metadata = { title: "Diagnóstico de webhooks" };

export default function WebhooksPage() {
  return (
    // Filtros e evento aberto ficam na URL (?referencia=, ?evento=).
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
      <SupportViewGate>
        <WebhookDiagnostics />
      </SupportViewGate>
    </Suspense>
  );
}
