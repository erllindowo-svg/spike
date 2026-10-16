"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

import { cn } from "@/lib/utils";

// Abas que são páginas (cada uma tem o seu endereço), com o visual da TabsList.
export type SectionTab = {
  href: string;
  label: string;
  badge?: number;
  // Ativa só no endereço exato; sem isto, também nas páginas filhas.
  exact?: boolean;
};

function isActive(pathname: string, tab: SectionTab): boolean {
  return tab.exact
    ? pathname === tab.href
    : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
}

function Tabs({ tabs, pathname }: { tabs: SectionTab[]; pathname: string }) {
  return (
    <nav
      aria-label="Seções"
      className="inline-flex h-8 w-fit items-center rounded-lg bg-muted p-[3px] text-muted-foreground"
    >
      {tabs.map((tab) => {
        const active = isActive(pathname, tab);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex h-full items-center gap-1.5 rounded-md px-2.5 text-sm font-medium whitespace-nowrap text-foreground/60 transition-all outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50",
              active && "bg-background text-foreground shadow-sm",
            )}
          >
            {tab.label}
            {!!tab.badge && (
              <span className="rounded-full bg-primary/10 px-1.5 text-xs text-primary tabular-nums">
                {tab.badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

function ActiveTabs({ tabs }: { tabs: SectionTab[] }) {
  return <Tabs tabs={tabs} pathname={usePathname()} />;
}

// usePathname pode suspender (Cache Components); o fallback mostra as abas
// sem a ativa marcada.
export function SectionTabs({ tabs }: { tabs: SectionTab[] }) {
  return (
    <Suspense fallback={<Tabs tabs={tabs} pathname="" />}>
      <ActiveTabs tabs={tabs} />
    </Suspense>
  );
}
