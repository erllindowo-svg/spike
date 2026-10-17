"use client";

import {
  BellIcon,
  DatabaseIcon,
  FlaskConicalIcon,
  InfoIcon,
  SearchIcon,
  SettingsIcon,
  XIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SupportOnly } from "@/features/settings/support-view";
import { useDemoStore } from "@/lib/demo-store";

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
      {mainNav.map((item: NavItem, index) => {
        const active = isNavItemActive(pathname, item);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex h-full items-center gap-1.5 rounded-md px-2.5 text-sm font-medium whitespace-nowrap text-foreground/60 transition-all outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50",
              active && "bg-background text-foreground shadow-sm",
            )}
          >
            <span className="hidden size-4 items-center justify-center rounded-sm border text-[10px] text-muted-foreground tabular-nums sm:flex">
              {index + 1}
            </span>
            <span className="hidden sm:inline">{item.title}</span>
            <span className="sm:hidden">{item.shortTitle ?? item.title}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function ActiveMainSwitch() {
  return <MainSwitch pathname={usePathname()} />;
}

// Título da página e o "i" com a explicação dela (navigation.ts). O título
// só aparece fora das duas páginas principais (a alternância já diz o nome
// delas).
function PageHeading() {
  const pathname = usePathname();
  const { title, help } = getPageInfo(pathname);
  const isMain = mainNav.some((item) => isNavItemActive(pathname, item));
  return (
    <div className="hidden min-w-0 items-center gap-1 md:flex">
      {!isMain && (
        <h1 className="truncate font-heading text-base font-semibold tracking-tight">
          {title}
        </h1>
      )}
      {help && (
        <Popover>
          <PopoverTrigger
            render={
              <Button
                variant="ghost"
                size="icon-xs"
                className="text-muted-foreground"
                aria-label={`O que é ${title}?`}
              />
            }
          >
            <InfoIcon />
          </PopoverTrigger>
          <PopoverContent>
            <PopoverTitle>{title}</PopoverTitle>
            <PopoverDescription>{help}</PopoverDescription>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

// Resumo cruzado dos alertas: o número de não lidos de todos os
// monitoramentos, a um clique de qualquer página.
function AlertsBell() {
  const { alerts } = useDemoStore();
  const unread = alerts.filter((a) => !a.readAt).length;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            nativeButton={false}
            render={<Link href="/informacoes" />}
            aria-label={
              unread > 0
                ? `Alertas: ${unread} não lidos`
                : "Alertas: nenhum não lido"
            }
          />
        }
      >
        <BellIcon />
        {unread > 0 && (
          <span className="absolute top-0.5 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground tabular-nums">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </TooltipTrigger>
      <TooltipContent>
        {unread > 0 ? `${unread} alertas não lidos` : "Nenhum alerta não lido"}
      </TooltipContent>
    </Tooltip>
  );
}

// Barra do topo, em três zonas (círculo 3, fatia 3): à esquerda, a marca e
// a alternância entre as duas páginas; no meio, a pesquisa; à direita,
// alertas e Configurações. A "conta" espera o login (círculo 4). No celular,
// a pesquisa vira um ícone que abre uma linha embaixo.
export function AppHeader() {
  const { dataSource } = useDemoStore();
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

          {/* Dados fictícios sempre se anunciam; a origem real dos dados só
              interessa ao suporte. */}
          {dataSource === "db" ? (
            <SupportOnly>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <span className="hidden h-7 shrink-0 cursor-default items-center gap-1.5 rounded-full border bg-muted px-2.5 text-xs font-medium text-muted-foreground sm:inline-flex" />
                  }
                >
                  <DatabaseIcon className="size-3.5" aria-hidden />
                  Banco
                </TooltipTrigger>
                <TooltipContent className="max-w-64">
                  Empresas, monitoramentos, consultas, webhooks e alertas ficam
                  no MongoDB. Situação de cada integração em Configurações.
                </TooltipContent>
              </Tooltip>
            </SupportOnly>
          ) : (
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
                Nenhuma consulta é feita à JUDIT nem ao banco de dados.
              </TooltipContent>
            </Tooltip>
          )}

          <AlertsBell />

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
