"use client";

import { SectionTabs } from "@/components/layout/section-tabs";
import { useDemoStore } from "@/lib/demo-store";

// Monitoramentos e os alertas que eles geram, lado a lado.
export function TrackingsSectionTabs() {
  const { alerts } = useDemoStore();
  const unread = alerts.filter((a) => !a.readAt).length;

  return (
    <SectionTabs
      tabs={[
        { href: "/monitoramentos", label: "Monitoramentos", exact: true },
        {
          href: "/monitoramentos/alertas",
          label: "Alertas",
          badge: unread,
        },
      ]}
    />
  );
}
