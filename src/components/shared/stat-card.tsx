import type { LucideIcon } from "lucide-react";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  href,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  // Com href, o cartão inteiro leva à lista de onde vem o número.
  href?: string;
}) {
  const card = (
    <Card
      className={cn(
        "h-full gap-3 px-4",
        href && "transition-shadow group-hover:ring-primary/40",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Icon className="size-4 text-muted-foreground/70" aria-hidden />
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="font-heading text-2xl font-semibold tracking-tight tabular-nums">
          {value}
        </span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
    </Card>
  );
  if (!href) return card;
  return (
    <Link
      href={href}
      className="group rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      {card}
    </Link>
  );
}
