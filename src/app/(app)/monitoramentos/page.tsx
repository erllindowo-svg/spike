import type { Metadata } from "next";

import { TrackingsPage } from "@/features/trackings/components/trackings-page";

export const metadata: Metadata = { title: "Monitoramentos" };

export default function MonitoringPage() {
  return <TrackingsPage />;
}
