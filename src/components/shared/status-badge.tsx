import { cn } from "@/lib/utils";

export type StatusTone =
  "success" | "warning" | "danger" | "info" | "pending" | "neutral";

const toneClasses: Record<StatusTone, string> = {
  success: "border-success/25 bg-success/8 text-success",
  warning: "border-warning/30 bg-warning/10 text-warning",
  danger: "border-destructive/25 bg-destructive/8 text-destructive",
  info: "border-info/25 bg-info/8 text-info",
  pending: "border-border bg-muted text-muted-foreground",
  neutral: "border-border bg-background text-muted-foreground",
};

const dotClasses: Record<StatusTone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
  info: "bg-info",
  pending: "bg-muted-foreground/60 animate-pulse",
  neutral: "bg-muted-foreground/50",
};

export function StatusBadge({
  tone,
  children,
  className,
}: {
  tone: StatusTone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-1.5 rounded-full border px-2 text-xs font-medium whitespace-nowrap",
        toneClasses[tone],
        className,
      )}
    >
      <span
        aria-hidden
        className={cn("size-1.5 rounded-full", dotClasses[tone])}
      />
      {children}
    </span>
  );
}
