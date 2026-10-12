import { StatusBadge, type StatusTone } from "@/components/shared/status-badge";
import {
  getTrackingDisplayState,
  trackingDisplayLabels,
  type TrackingDisplayState,
} from "@/features/trackings/types";

const tones: Record<TrackingDisplayState, StatusTone> = {
  pending_first_run: "pending",
  active: "success",
  paused: "neutral",
  completed: "info",
  failed: "danger",
  unknown: "warning",
};

export function TrackingStatusBadge({ status }: { status: string | null }) {
  const state = getTrackingDisplayState(status);
  return (
    <StatusBadge tone={tones[state]}>
      {trackingDisplayLabels[state]}
    </StatusBadge>
  );
}
