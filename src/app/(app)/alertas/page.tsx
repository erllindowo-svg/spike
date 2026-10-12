import type { Metadata } from "next";

import { AlertsCenter } from "@/features/alerts/components/alerts-center";

export const metadata: Metadata = { title: "Alertas" };

export default function AlertsPage() {
  return <AlertsCenter />;
}
