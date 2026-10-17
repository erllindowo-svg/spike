import type { Metadata } from "next";
import { Suspense } from "react";

import { PageSkeleton } from "@/components/shared/page-skeleton";
import { InfoPage } from "@/features/subjects/components/info-page";
import { listQueries } from "@/lib/data";

export const metadata: Metadata = { title: "Acervo" };

// Lê o banco dentro do Suspense, para que a navegação entre páginas mostre o
// esqueleto em vez de esperar o banco (catálogo do diário, D5).
export default function InformationPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <InformationContent />
    </Suspense>
  );
}

async function InformationContent() {
  return <InfoPage queries={await listQueries()} />;
}
