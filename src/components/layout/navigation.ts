import {
  Building2Icon,
  FileSearchIcon,
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
  // Outros caminhos que também marcam o item como ativo.
  matches?: string[];
};

// Menu organizado pelas tarefas de quem usa o app (círculo 1 do escopo,
// docs/etapa-7-escopo.md). Os alertas ficam dentro de Monitoramentos.
export const productNav: NavItem[] = [
  { title: "Dashboard", href: "/", icon: LayoutDashboardIcon },
  {
    title: "Empresas e pessoas",
    href: "/empresas",
    icon: Building2Icon,
    matches: ["/pessoas"],
  },
  { title: "Monitoramentos", href: "/monitoramentos", icon: RadarIcon },
  { title: "Consultas", href: "/consultas", icon: FileSearchIcon },
];

// Itens pequenos do rodapé do menu. O Diagnóstico só aparece com a vista de
// suporte ligada (src/features/settings/support-view.tsx).
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
// primeiro: /monitoramentos/alertas antes de /monitoramentos.
type PageInfo = { prefix: string; title: string; help: string };

const pages: PageInfo[] = [
  {
    prefix: "/monitoramentos/alertas",
    title: "Alertas",
    help: "Avisos gerados pelos monitoramentos: processo novo, movimentação ou um problema no próprio monitoramento. Abrir um alerta marca como lido.",
  },
  {
    prefix: "/monitoramentos",
    title: "Monitoramentos",
    help: "Vigilância contínua feita pela JUDIT. Por CNPJ ou CPF, avisa quando surge um processo novo da empresa ou da pessoa; por número CNJ, avisa cada movimentação de um processo. Cada aviso vira um alerta, na aba Alertas.",
  },
  {
    prefix: "/empresas",
    title: "Empresas",
    help: "Empresas que você adicionou ou monitora. Um CNPJ que ainda não está na lista pode ser adicionado, com ou sem consulta aos dados cadastrais na JUDIT (cobrada). Abra uma empresa para consultar os processos dela.",
  },
  {
    prefix: "/pessoas",
    title: "Pessoas físicas",
    help: "Pessoas físicas que você adicionou ou monitora. O CPF é dado pessoal: aparece mascarado nas listas e completo só na página da pessoa. Consulte e monitore só com base legal.",
  },
  {
    prefix: "/consultas",
    title: "Consultas",
    help: "Histórico das consultas feitas à JUDIT. A síncrona responde na hora; a assíncrona é criada, processada pela JUDIT e concluída depois. Cada consulta é cobrada.",
  },
  {
    prefix: "/processos",
    title: "Processo",
    help: "Capa e movimentações de um processo, com o monitoramento dele, se houver.",
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
    title: "Dashboard",
    help: "Resumo do que o app acompanha: empresas, monitoramentos, alertas e consultas. O bloco “O que chegou” mostra os alertas ainda não lidos. Abrir esta página não consulta a JUDIT.",
  },
];

export function getPageInfo(pathname: string): { title: string; help: string } {
  const page =
    pages.find((p) =>
      p.prefix === "/" ? pathname === "/" : isNavActive(pathname, p.prefix),
    ) ?? null;
  return page ?? { title: "Raio-X Jurídico", help: "" };
}
