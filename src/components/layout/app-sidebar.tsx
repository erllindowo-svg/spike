"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { useDemoStore } from "@/lib/demo-store";

import { BrandMark } from "./brand";
import {
  integrationNav,
  isNavActive,
  productNav,
  settingsNav,
  type NavItem,
} from "./navigation";

function NavLinkButton({
  item,
  badge,
  active,
}: {
  item: NavItem;
  badge?: number;
  active: boolean;
}) {
  const { isMobile, setOpenMobile } = useSidebar();

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={active}
        tooltip={item.title}
        render={
          <Link
            href={item.href}
            aria-current={active ? "page" : undefined}
            onClick={() => isMobile && setOpenMobile(false)}
          />
        }
        className="data-active:text-primary"
      >
        <item.icon />
        <span>{item.title}</span>
      </SidebarMenuButton>
      {!!badge && (
        <SidebarMenuBadge className="bg-primary/10 text-primary peer-data-active/menu-button:text-primary">
          {badge}
        </SidebarMenuBadge>
      )}
    </SidebarMenuItem>
  );
}

function ActiveNavLink(props: { item: NavItem; badge?: number }) {
  const pathname = usePathname();
  return (
    <NavLinkButton {...props} active={isNavActive(pathname, props.item.href)} />
  );
}

// usePathname suspende em rotas com params dinâmicos (Cache Components);
// o fallback mantém o link estático até o estado ativo ser resolvido.
function NavLink(props: { item: NavItem; badge?: number }) {
  return (
    <Suspense fallback={<NavLinkButton {...props} active={false} />}>
      <ActiveNavLink {...props} />
    </Suspense>
  );
}

export function AppSidebar() {
  const { alerts, webhookEvents } = useDemoStore();
  const unreadAlerts = alerts.filter((a) => !a.readAt).length;
  const pendingEvents = webhookEvents.filter(
    (e) => e.processingStatus === "failed" || e.processingStatus === "pending",
  ).length;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={<Link href="/" />}
              className="hover:bg-transparent"
            >
              <BrandMark />
              <span className="flex min-w-0 flex-col leading-tight">
                <span className="font-heading text-sm font-semibold tracking-tight">
                  Raio-X Jurídico
                </span>
                <span className="text-xs text-muted-foreground">
                  Inteligência processual
                </span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Produto</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {productNav.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  badge={item.href === "/alertas" ? unreadAlerts : undefined}
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Integração</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {integrationNav.map((item) => (
                <NavLink key={item.href} item={item} badge={pendingEvents} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <NavLink item={settingsNav} />
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
