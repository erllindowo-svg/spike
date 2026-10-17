import {
  LayoutDashboardIcon,
  SearchIcon,
  SettingsIcon,
  WebhookIcon,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  title: string;
  // Rótulo curto, para o celular.
  shortTitle?: string;
  href: string;
  icon: LucideIcon;
  // Outros caminhos que também marcam o item como ativo.
  matches?: string[];
};

// Duas páginas principais, uma por função (círculo 3 do escopo,
// docs/etapa-7-escopo.md): Consultar (fazer) e Minhas informações (ver). A
// barra do topo alterna entre as duas, como dois espaços de trabalho.
export const consultNav: NavItem = {
  title: "Consultar",
  href: "/",
  icon: SearchIcon,
};

export const infoNav: NavItem = {
  title: "Minhas informações",
  shortTitle: "Informações",
  href: "/informacoes",
  icon: LayoutDashboardIcon,
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

// Título e ajuda (o "i" ao lado do título) de cada página. Duas ou três
// frases, para quem nunca usou o app. Os prefixos mais específicos vêm
// primeiro.
type PageInfo = { prefix: string; title: string; help: string };

const pages: PageInfo[] = [
  {
    prefix: "/informacoes",
    title: "Minhas informações",
    help: "Tudo o que o app já sabe. No topo, o que chegou (alertas) e os números; embaixo, cada identificador que você pesquisou, monitorou ou salvou, que abre a ficha com consultas, dados guardados, monitoramento e alertas. Abrir esta página não consulta a JUDIT.",
  },
  {
    prefix: "/webhooks",
    title: "Diagnóstico de webhooks",
    help: "Registro técnico das entregas de webhook da JUDIT: o que chegou, quando e o que o app fez com cada entrega. Serve para investigar falhas e duplicidades.",
  },
  {
    prefix: "/configuracoes",
    title: "Configurações",
    help: "Situação das integrações (JUDIT, webhooks e banco), calculada a partir das variáveis de ambiente do servidor, e a vista de suporte.",
  },
  {
    prefix: "/",
    title: "Consultar",
    help: "Digite um CPF, CNPJ, número de processo (CNJ), OAB, nome ou RJI: o tipo é reconhecido pela digitação. Depois escolha o que quer saber e clique em Consultar (uma resposta, cobrada uma vez) ou, onde existe, em Monitorar (acompanhamento cobrado a cada execução).",
  },
];

export function getPageInfo(pathname: string): { title: string; help: string } {
  const page =
    pages.find((p) =>
      p.prefix === "/" ? pathname === "/" : isNavActive(pathname, p.prefix),
    ) ?? null;
  return page ?? { title: "Raio-X Jurídico", help: "" };
}
