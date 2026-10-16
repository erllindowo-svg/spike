"use client";

import { PanelLeftCloseIcon, PanelLeftOpenIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useSupportView } from "@/features/settings/support-view";
import { useDemoStore } from "@/lib/demo-store";

import { BrandMark } from "./brand";
import {
  isNavActive,
  productNav,
  settingsNav,
  supportNav,
  type NavItem,
} from "./navigation";

type NavLinkProps = {
  item: NavItem;
  badge?: number;
  size?: "default" | "sm";
};

function NavLinkButton({
  item,
  badge,
  size = "default",
  active,
}: NavLinkProps & { active: boolean }) {
  const { isMobile, setOpenMobile } = useSidebar();

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={active}
        size={size}
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

function ActiveNavLink(props: NavLinkProps) {
  const pathname = usePathname();
  return (
    <NavLinkButton {...props} active={isNavActive(pathname, props.item.href)} />
  );
}

// usePathname suspende em rotas com params dinâmicos (Cache Components);
// o fallback mantém o link estático até o estado ativo ser resolvido.
function NavLink(props: NavLinkProps) {
  return (
    <Suspense fallback={<NavLinkButton {...props} active={false} />}>
      <ActiveNavLink {...props} />
    </Suspense>
  );
}

// O menu nasce recolhido, só com os ícones (o nome aparece ao passar o mouse).
// Quem preferir os nomes expande por aqui, ou com Ctrl+B. No celular o menu
// é uma gaveta, aberta pelo botão do cabeçalho, e este botão some.
function ExpandToggle() {
  const { open, toggleSidebar, isMobile } = useSidebar();
  if (isMobile) return null;
  const label = open ? "Recolher menu" : "Expandir menu";
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        size="sm"
        tooltip={`${label} (Ctrl+B)`}
        onClick={toggleSidebar}
      >
        {open ? <PanelLeftCloseIcon /> : <PanelLeftOpenIcon />}
        <span>{label}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function AppSidebar() {
  const { alerts, webhookEvents } = useDemoStore();
  const [supportView] = useSupportView();
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
          <SidebarGroupContent>
            <SidebarMenu>
              {productNav.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  // Os alertas moram em Monitoramentos: o número de não
                  // lidos aparece nele.
                  badge={
                    item.href === "/monitoramentos" ? unreadAlerts : undefined
                  }
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          {supportView && (
            <NavLink item={supportNav} badge={pendingEvents} size="sm" />
          )}
          <ExpandToggle />
          <NavLink item={settingsNav} size="sm" />
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
