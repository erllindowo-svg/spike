import {
  searchTypeLabels,
  type TrackingSearchType,
} from "@/features/trackings/types";

export function SearchTypeBadge({ type }: { type: TrackingSearchType }) {
  return (
    <span className="inline-flex h-5 items-center rounded-md border bg-muted/50 px-1.5 font-mono text-[11px] font-medium text-muted-foreground">
      {searchTypeLabels[type]}
    </span>
  );
}
