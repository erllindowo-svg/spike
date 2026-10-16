import type { Metadata } from "next";
import { Suspense } from "react";

import { PageSkeleton } from "@/components/shared/page-skeleton";
import { QueriesPage } from "@/features/queries/components/queries-page";
import { listQueries } from "@/lib/data";

export const metadata: Metadata = { title: "Consultas" };

// Lê o banco dentro do Suspense, para que o shell da rota continue estático.
export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <QueriesContent />
    </Suspense>
  );
}

async function QueriesContent() {
  return <QueriesPage queries={await listQueries()} />;
}
