import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { GlobalSearch } from "@/components/layout/global-search";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { NewTrackingDialogProvider } from "@/features/trackings/components/new-tracking-dialog";
import { getInitialDemoState, listCompanies, listLawsuits } from "@/lib/data";
import { DemoStoreProvider } from "@/lib/demo-store";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <DemoStoreProvider
      initialState={getInitialDemoState()}
      companies={listCompanies()}
      lawsuits={listLawsuits()}
    >
      <NewTrackingDialogProvider>
        <SidebarProvider>
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
