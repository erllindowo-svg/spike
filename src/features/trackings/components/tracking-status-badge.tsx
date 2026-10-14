import { StatusBadge, type StatusTone } from "@/components/shared/status-badge";
import {
  getTrackingDisplayState,
  trackingDisplayLabels,
  type Tracking,
  type TrackingDisplayState,
} from "@/features/trackings/types";

const tones: Record<TrackingDisplayState, StatusTone> = {
  not_sent: "neutral",
  uncertain: "warning",
  rejected: "danger",
  pending_first_run: "pending",
  active: "success",
  paused: "neutral",
  completed: "info",
  failed: "danger",
  unknown: "warning",
};

export function TrackingStatusBadge({
  tracking,
}: {
  tracking: Pick<Tracking, "status" | "creation">;
}) {
  const state = getTrackingDisplayState(tracking);
  return (
    <StatusBadge tone={tones[state]}>
      {trackingDisplayLabels[state]}
    </StatusBadge>
  );
}
