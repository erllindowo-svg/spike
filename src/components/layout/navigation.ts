import {
  BellIcon,
  Building2Icon,
  LayoutDashboardIcon,
  RadarIcon,
  SettingsIcon,
  WebhookIcon,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
};

export const productNav: NavItem[] = [
  { title: "Visão geral", href: "/", icon: LayoutDashboardIcon },
  { title: "Empresas", href: "/empresas", icon: Building2Icon },
  { title: "Monitoramentos", href: "/monitoramentos", icon: RadarIcon },
  { title: "Alertas", href: "/alertas", icon: BellIcon },
];

export const integrationNav: NavItem[] = [
  { title: "Diagnóstico de webhooks", href: "/webhooks", icon: WebhookIcon },
];

export const settingsNav: NavItem = {
  title: "Configurações",
  href: "/configuracoes",
  icon: SettingsIcon,
};

const extraTitles: { prefix: string; title: string }[] = [
  { prefix: "/processos", title: "Processo" },
];

export function isNavActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function getPageTitle(pathname: string): string {
  const item = [...productNav, ...integrationNav, settingsNav].find((i) =>
    isNavActive(pathname, i.href),
  );
  if (item) return item.title;
  return (
    extraTitles.find((e) => pathname.startsWith(e.prefix))?.title ??
    "Raio-X Jurídico"
  );
}
