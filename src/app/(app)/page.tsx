import type { Metadata } from "next";
import { Suspense } from "react";

import { PageSkeleton } from "@/components/shared/page-skeleton";
import { ConsultPage } from "@/features/consult/components/consult-page";

export const metadata: Metadata = { title: "Consultar" };

export default function Page() {
  return (
    // O identificador pode vir na URL (?tipo=&valor=), lida no cliente.
    <Suspense fallback={<PageSkeleton />}>
      <ConsultPage />
    </Suspense>
  );
}
