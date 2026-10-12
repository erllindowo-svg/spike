"use client";

import { FlaskConicalIcon, LogOutIcon, SettingsIcon } from "lucide-react";
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
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { GlobalSearch } from "./global-search";
import { getPageTitle } from "./navigation";

function PageTitle() {
  return <>{getPageTitle(usePathname())}</>;
}

export function AppHeader() {
  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-backdrop-filter:bg-background/80 md:px-6">
      <SidebarTrigger className="-ml-1.5" />
      <Separator orientation="vertical" className="h-5!" />
      <h1 className="truncate font-heading text-base font-semibold tracking-tight md:min-w-40">
        <Suspense>
          <PageTitle />
        </Suspense>
      </h1>

      <div className="ml-auto flex flex-1 items-center justify-end gap-3">
        <div className="hidden flex-1 justify-center md:flex">
          <GlobalSearch />
        </div>

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
              <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
                UD
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="flex flex-col">
                <span className="text-sm font-medium text-foreground">
                  Usuário de demonstração
                </span>
                <span className="text-xs font-normal text-muted-foreground">
                  Autenticação ainda não implementada
                </span>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href="/configuracoes" />}>
              <SettingsIcon />
              Configurações
            </DropdownMenuItem>
            <DropdownMenuItem disabled>
              <LogOutIcon />
              Sair (indisponível)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
