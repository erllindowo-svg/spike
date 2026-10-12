import {
  ActivityIcon,
  FilePlus2Icon,
  RadarIcon,
  ScrollTextIcon,
  TriangleAlertIcon,
  WebhookIcon,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import type { ActivityItem, ActivityKind } from "@/features/activity/types";
import { formatShortDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const kindStyles: Record<
  ActivityKind,
  { icon: LucideIcon; className: string }
> = {
  new_lawsuit: { icon: FilePlus2Icon, className: "bg-primary/10 text-primary" },
  lawsuit_movement: {
    icon: ScrollTextIcon,
    className: "bg-info/10 text-info",
  },
  tracking_created: {
    icon: RadarIcon,
    className: "bg-success/10 text-success",
  },
  webhook_received: {
    icon: WebhookIcon,
    className: "bg-muted text-muted-foreground",
  },
  processing_failed: {
    icon: TriangleAlertIcon,
    className: "bg-destructive/10 text-destructive",
  },
};

export function ActivityFeed({
  items,
  limit = 8,
}: {
  items: ActivityItem[];
  limit?: number;
}) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={ActivityIcon}
        title="Sem atividade recente"
        description="Eventos de monitoramentos e webhooks aparecerão aqui."
      />
    );
  }

  return (
    <ol className="relative flex flex-col">
      {items.slice(0, limit).map((item, index, list) => {
        const { icon: Icon, className } = kindStyles[item.kind];
        const content = (
          <>
            <span className="text-sm font-medium text-foreground">
              {item.title}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {item.description}
            </span>
          </>
        );
        return (
          <li key={item.id} className="relative flex gap-3 pb-4 last:pb-0">
            {index < list.length - 1 && (
              <span
                aria-hidden
                className="absolute top-8 bottom-0 left-3.5 w-px bg-border"
              />
            )}
            <span
              className={cn(
                "relative flex size-7 shrink-0 items-center justify-center rounded-full",
                className,
              )}
            >
              <Icon className="size-3.5" aria-hidden />
            </span>
            <div className="flex min-w-0 flex-1 items-start justify-between gap-3 pt-0.5">
              {item.href ? (
                <Link
                  href={item.href}
                  className="flex min-w-0 flex-col rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50 hover:[&>span:first-child]:text-primary"
                >
                  {content}
                </Link>
              ) : (
                <div className="flex min-w-0 flex-col">{content}</div>
              )}
              <time
                dateTime={item.occurredAt.toISOString()}
                className="shrink-0 text-xs text-muted-foreground tabular-nums"
              >
                {formatShortDateTime(item.occurredAt)}
              </time>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
