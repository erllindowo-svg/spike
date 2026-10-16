import { StatusBadge } from "@/components/shared/status-badge";
import { getRegistrationStatusTone } from "@/features/parties/types";

export function RegistrationStatusBadge({ status }: { status: string | null }) {
  const tone = getRegistrationStatusTone(status);
  return (
    <StatusBadge tone={tone === "neutral" ? "pending" : tone}>
      {status ?? "Indisponível"}
    </StatusBadge>
  );
}
