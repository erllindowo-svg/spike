export type ActivityKind =
  | "new_lawsuit"
  | "lawsuit_movement"
  | "tracking_created"
  | "webhook_received"
  | "processing_failed";

export type ActivityItem = {
  id: string;
  kind: ActivityKind;
  title: string;
  description: string;
  occurredAt: Date;
  partyId: string | null;
  href: string | null;
};
