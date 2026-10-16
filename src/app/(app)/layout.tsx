import { Suspense } from "react";

import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { GlobalSearch } from "@/components/layout/global-search";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { NewTrackingDialogProvider } from "@/features/trackings/components/new-tracking-dialog";
import {
  getDataSource,
  getInitialState,
  listParties,
  listLawsuits,
} from "@/lib/data";
import { DemoStoreProvider } from "@/lib/demo-store";

// No modo "db", os dados só são lidos na requisição; o Suspense mostra o
// esqueleto enquanto o MongoDB responde. No modo "demo", tudo continua
// pré-renderizado e o esqueleto não chega a aparecer.
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
  const [initialState, parties, lawsuits] = await Promise.all([
    getInitialState(),
    listParties(),
    listLawsuits(),
  ]);

  return (
    <DemoStoreProvider
      dataSource={getDataSource()}
      initialState={initialState}
      parties={parties}
      lawsuits={lawsuits}
    >
      <NewTrackingDialogProvider>
        {/* Recolhido por padrão: só os ícones (app-sidebar.tsx). */}
        <SidebarProvider defaultOpen={false}>
          <AppSidebar />
          <SidebarInset className="min-w-0">
            <AppHeader />
            <div className="border-b bg-background px-4 py-2 md:hidden">
              <GlobalSearch />
            </div>
            <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-4 md:p-6">
              {children}
            </main>
          </SidebarInset>
        </SidebarProvider>
      </NewTrackingDialogProvider>
    </DemoStoreProvider>
  );
}
