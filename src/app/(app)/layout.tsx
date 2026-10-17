import { Suspense } from "react";

import { AppHeader } from "@/components/layout/app-header";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { NewTrackingDialogProvider } from "@/features/trackings/components/new-tracking-dialog";
import {
  getInitialState,
  listParties,
  listLawsuits,
  listQueries,
} from "@/lib/data";
import { DemoStoreProvider } from "@/lib/demo-store";

// Os dados fictícios são pré-renderizados no build; o esqueleto do Suspense
// quase não chega a aparecer.
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense
      fallback={
        <main className="mx-auto w-full max-w-7xl p-4 md:p-6">
          <PageSkeleton />
        </main>
      }
    >
      <AppData>{children}</AppData>
    </Suspense>
  );
}

async function AppData({ children }: { children: React.ReactNode }) {
  const [initialState, parties, lawsuits, queries] = await Promise.all([
    getInitialState(),
    listParties(),
    listLawsuits(),
    listQueries(),
  ]);

  return (
    <DemoStoreProvider
      initialState={initialState}
      parties={parties}
      lawsuits={lawsuits}
      queries={queries}
    >
      <NewTrackingDialogProvider>
        {/* Navegação só no topo (círculo 3, fatia 3): duas páginas
              principais não precisam de um menu lateral. */}
        <div className="flex min-h-svh flex-col">
          <AppHeader />
          <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-4 md:p-6">
            {children}
          </main>
        </div>
      </NewTrackingDialogProvider>
    </DemoStoreProvider>
  );
}
