"use client";

import { usePathname } from "next/navigation";
import { Suspense } from "react";

import { SectionTabs } from "./section-tabs";
import { infoNav, infoSections, isNavItemActive } from "./navigation";

// Abas provisórias de "Minhas informações": levam às páginas atuais até a
// página nova existir (círculo 3, fatia 6).
function ActiveInfoSubnav() {
  const pathname = usePathname();
  if (!isNavItemActive(pathname, infoNav)) return null;
  return (
    <div className="overflow-x-auto border-b bg-background px-4 py-2 md:px-6">
      <SectionTabs tabs={infoSections} />
    </div>
  );
}

export function InfoSubnav() {
  return (
    <Suspense fallback={null}>
      <ActiveInfoSubnav />
    </Suspense>
  );
}
