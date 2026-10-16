"use client";

import {
  BellIcon,
  DatabaseIcon,
  FlaskConicalIcon,
  InfoIcon,
  SettingsIcon,
  UserIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SupportOnly } from "@/features/settings/support-view";
import { useDemoStore } from "@/lib/demo-store";

import { GlobalSearch } from "./global-search";
import { getPageInfo } from "./navigation";

// Título da página e o "i" com a explicação dela (navigation.ts).
function PageHeading() {
  const { title, help } = getPageInfo(usePathname());
  return (
    <div className="flex min-w-0 items-center gap-1 md:min-w-40">
      <h1 className="truncate font-heading text-base font-semibold tracking-tight">
        {title}
      </h1>
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
            render={<Link href="/monitoramentos/alertas" />}
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

export function AppHeader() {
  const { dataSource } = useDemoStore();

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-backdrop-filter:bg-background/80 md:px-6">
      {/* Só no celular, onde o menu é uma gaveta. No computador, o botão de
          expandir fica no rodapé do próprio menu. */}
      <SidebarTrigger className="-ml-1.5 md:hidden" />
      <Separator orientation="vertical" className="h-5! md:hidden" />
      <Suspense fallback={<div className="md:min-w-40" />}>
        <PageHeading />
      </Suspense>

      <div className="ml-auto flex flex-1 items-center justify-end gap-2 md:gap-3">
        <div className="hidden flex-1 justify-center md:flex">
          <GlobalSearch />
        </div>

        {/* Dados fictícios sempre se anunciam; a origem real dos dados só
            interessa ao suporte. */}
        {dataSource === "db" ? (
          <SupportOnly>
            <Tooltip>
              <TooltipTrigger
                render={
                  <span className="inline-flex h-7 shrink-0 cursor-default items-center gap-1.5 rounded-full border bg-muted px-2.5 text-xs font-medium text-muted-foreground" />
                }
              >
                <DatabaseIcon className="size-3.5" aria-hidden />
                <span className="hidden sm:inline">Banco de dados</span>
                <span className="sm:hidden">Banco</span>
              </TooltipTrigger>
              <TooltipContent className="max-w-64">
                Empresas, monitoramentos, consultas, webhooks e alertas ficam no
                MongoDB. Processos não são copiados: são lidos da JUDIT quando
                você consulta. Situação de cada integração em Configurações.
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
              <span className="hidden sm:inline">Dados de demonstração</span>
              <span className="sm:hidden">Demo</span>
            </TooltipTrigger>
            <TooltipContent className="max-w-64">
              Todas as informações são fictícias e ficam apenas em memória.
              Nenhuma consulta é feita à JUDIT nem ao banco de dados.
            </TooltipContent>
          </Tooltip>
        )}

        <AlertsBell />

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full"
                aria-label="Menu do perfil"
              />
            }
          >
            <Avatar className="size-7">
              <AvatarFallback className="bg-primary/10 text-primary">
                <UserIcon className="size-4" aria-hidden />
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="flex flex-col">
                <span className="text-sm font-medium text-foreground">
                  Sem login
                </span>
                <span className="text-xs font-normal text-muted-foreground">
                  O app ainda não tem contas de usuário: quem abre este endereço
                  vê tudo.
                </span>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href="/configuracoes" />}>
              <SettingsIcon />
              Configurações
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
