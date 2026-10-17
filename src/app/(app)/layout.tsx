import { connection } from "next/server";
import { Suspense } from "react";

import { AppHeader } from "@/components/layout/app-header";
import { SetupScreen } from "@/components/layout/setup-screen";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { SupportViewProvider } from "@/features/settings/support-view";
import { NewTrackingDialogProvider } from "@/features/trackings/components/new-tracking-dialog";
import { AppStoreProvider } from "@/lib/app-store";
import {
  getInitialState,
  getSupportViewPreference,
  listParties,
  listQueries,
} from "@/lib/data";
import { missingRequiredEnv } from "@/lib/env";

// Os dados só são lidos na requisição; o Suspense mostra o esqueleto
// enquanto o MongoDB responde. Sem o banco ou a chave da JUDIT, o app não
// abre: a tela de configuração diz o que falta (setup-screen.tsx).
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
  // O ambiente é lido na requisição, e não no build: sem isso, a tela
  // refletiria as variáveis da máquina onde o build rodou.
  await connection();
  const missing = missingRequiredEnv();
  if (missing.length > 0) return <SetupScreen missing={missing} />;

  const [initialState, parties, queries, supportView] = await Promise.all([
    getInitialState(),
    listParties(),
    listQueries(),
    getSupportViewPreference(),
  ]);

  return (
    <SupportViewProvider initial={supportView}>
      <AppStoreProvider
        initialState={initialState}
        parties={parties}
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
      </AppStoreProvider>
    </SupportViewProvider>
  );
}
