import { StatusBadge, type StatusTone } from "@/components/shared/status-badge";
import {
  lawsuitStatusLabels,
  type LawsuitStatus,
} from "@/features/processes/types";
import { NOT_AVAILABLE } from "@/lib/format";

const tones: Record<LawsuitStatus, StatusTone> = {
  active: "info",
  archived: "neutral",
  suspended: "warning",
};

export function LawsuitStatusBadge({
  status,
}: {
  status: LawsuitStatus | null;
}) {
  if (!status) return <StatusBadge tone="pending">{NOT_AVAILABLE}</StatusBadge>;
  return (
    <StatusBadge tone={tones[status]}>
      {lawsuitStatusLabels[status]}
    </StatusBadge>
  );
}
