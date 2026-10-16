import { TrackingsSectionTabs } from "@/features/trackings/components/trackings-section-tabs";

// Os alertas nascem dos eventos dos monitoramentos, por isso moram aqui,
// numa aba ao lado da lista (círculo 1 do escopo, docs/etapa-7-escopo.md).
export default function TrackingsLayout({
  children,
}: LayoutProps<"/monitoramentos">) {
  return (
    <>
      <TrackingsSectionTabs />
      {children}
    </>
  );
}
