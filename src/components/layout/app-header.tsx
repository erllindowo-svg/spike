"use client";

import {
  FlaskConicalIcon,
  SearchIcon,
  SettingsIcon,
  XIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AlertsMenu } from "@/features/alerts/components/alerts-menu";
import { WalletButton } from "@/features/settings/components/wallet";
import { TabBadge } from "./tab-badge";

import { cn } from "@/lib/utils";

import { BrandMark } from "./brand";
import { GlobalSearch } from "./global-search";
import {
  getPageInfo,
  isNavItemActive,
  mainNav,
  settingsNav,
  type NavItem,
} from "./navigation";

// Alternância entre as duas páginas principais, como dois espaços de
// trabalho: a ativa fica destacada, com o nome.
function MainSwitch({ pathname }: { pathname: string }) {
  return (
    <nav
      aria-label="Páginas principais"
      className="inline-flex h-8 items-center rounded-lg bg-muted p-[3px]"
    >
      {mainNav.map((item: NavItem) => {
        const active = isNavItemActive(pathname, item);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            // Recolhida, a página fica só com o ícone; o nome vai para o
            // leitor de tela e para a dica do mouse.
            aria-label={item.title}
            title={active ? undefined : item.title}
            className={cn(
              "inline-flex h-full items-center gap-1.5 rounded-md px-2 text-sm font-medium whitespace-nowrap text-foreground/60 transition-all outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50",
              active && "bg-background px-2.5 text-foreground shadow-sm",
            )}
          >
            <item.icon className="size-4" aria-hidden />
            {active && <span>{item.title}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

function ActiveMainSwitch() {
  return <MainSwitch pathname={usePathname()} />;
}

// Título da página, só fora das duas páginas principais (a alternância já
// diz o nome delas).
function PageHeading() {
  const pathname = usePathname();
  const { title } = getPageInfo(pathname);
  const isMain = mainNav.some((item) => isNavItemActive(pathname, item));
  if (isMain) return null;
  return (
    <h1 className="hidden min-w-0 truncate font-heading text-base font-semibold tracking-tight md:block">
      {title}
    </h1>
  );
}

// Barra do topo, em três zonas (círculo 3, fatia 3): à esquerda, a marca e
// a alternância entre as duas páginas; no meio, a pesquisa; à direita,
// carteira, alertas e Configurações. A "conta" espera o login. No celular,
// a pesquisa vira um ícone que abre uma linha embaixo.
export function AppHeader() {
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <header className="sticky top-0 z-20 shrink-0 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
      <div className="flex h-14 items-center gap-2 px-4 sm:gap-3 md:px-6">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          aria-label="Raio-X Jurídico: Consultar"
        >
          <BrandMark />
          <span className="hidden font-heading text-sm font-semibold tracking-tight lg:inline">
            Raio-X Jurídico
          </span>
        </Link>
        <Suspense fallback={<MainSwitch pathname="" />}>
          <ActiveMainSwitch />
        </Suspense>
        <Suspense fallback={null}>
          <PageHeading />
        </Suspense>

        <div className="hidden flex-1 justify-center md:flex">
          <GlobalSearch />
        </div>

        <div className="ml-auto flex shrink-0 items-center md:ml-0 md:gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label={searchOpen ? "Fechar pesquisa" : "Pesquisar"}
            aria-expanded={searchOpen}
            onClick={() => setSearchOpen((open) => !open)}
          >
            {searchOpen ? <XIcon /> : <SearchIcon />}
          </Button>

          {/* O protótipo sempre se anuncia: tudo aqui é fictício. */}
          <Tooltip>
            <TooltipTrigger
              render={
                <span className="inline-flex h-7 shrink-0 cursor-default items-center gap-1.5 rounded-full border border-warning/30 bg-warning/10 px-2.5 text-xs font-medium text-warning" />
              }
            >
              <FlaskConicalIcon className="size-3.5" aria-hidden />
              <span className="hidden sm:inline">Demonstração</span>
              <span className="sm:hidden">Demo</span>
            </TooltipTrigger>
            <TooltipContent className="max-w-64">
              Todas as informações são fictícias e ficam apenas em memória.
              Nenhuma consulta é feita à JUDIT nem a um banco de dados.
            </TooltipContent>
          </Tooltip>

          <WalletButton />
          <AlertsMenu />
          <TabBadge />

          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  nativeButton={false}
                  render={<Link href={settingsNav.href} />}
                  aria-label={settingsNav.title}
                />
              }
            >
              <SettingsIcon />
            </TooltipTrigger>
            <TooltipContent>{settingsNav.title}</TooltipContent>
          </Tooltip>
        </div>
      </div>
      {searchOpen && (
        <div className="border-t px-4 py-2 md:hidden">
          <GlobalSearch onNavigate={() => setSearchOpen(false)} />
        </div>
      )}
    </header>
  );
}
