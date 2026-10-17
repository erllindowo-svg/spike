import {
  LibraryBigIcon,
  NotebookPenIcon,
  SettingsIcon,
  WebhookIcon,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  // Outros caminhos que também marcam o item como ativo.
  matches?: string[];
};

// Duas páginas principais, uma por função (círculo 3 do escopo,
// docs/etapa-7-escopo.md): Consultar (fazer) e Acervo (ver). A
// barra do topo alterna entre as duas, como dois espaços de trabalho: a
// ativa aparece com o nome, a outra só com o ícone (círculo 3B).
export const consultNav: NavItem = {
  title: "Consultar",
  href: "/",
  icon: NotebookPenIcon,
};

export const infoNav: NavItem = {
  title: "Acervo",
  href: "/acervo",
  icon: LibraryBigIcon,
};

export const mainNav: NavItem[] = [consultNav, infoNav];

// O Diagnóstico de webhooks fica dentro de Configurações, e só com a vista
// de suporte ligada (src/features/settings/support-view.tsx).
export const supportNav: NavItem = {
  title: "Diagnóstico de webhooks",
  href: "/webhooks",
  icon: WebhookIcon,
};

export const settingsNav: NavItem = {
  title: "Configurações",
  href: "/configuracoes",
  icon: SettingsIcon,
};

export function isNavActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function isNavItemActive(pathname: string, item: NavItem): boolean {
  return [item.href, ...(item.matches ?? [])].some((href) =>
    isNavActive(pathname, href),
  );
}

// Título de cada página. Os prefixos mais específicos vêm primeiro. O "i"
// com a ajuda de cada página saiu no círculo 5: o fluxo das páginas já se
// explica.
type PageInfo = { prefix: string; title: string };

const pages: PageInfo[] = [
  {
    prefix: "/acervo",
    title: "Acervo",
  },
  {
    prefix: "/webhooks",
    title: "Diagnóstico de webhooks",
  },
  {
    prefix: "/configuracoes",
    title: "Configurações",
  },
  {
    prefix: "/",
    title: "Consultar",
  },
];

export function getPageInfo(pathname: string): { title: string } {
  const page =
    pages.find((p) =>
      p.prefix === "/" ? pathname === "/" : isNavActive(pathname, p.prefix),
    ) ?? null;
  return page ?? { title: "Raio-X Jurídico" };
}
