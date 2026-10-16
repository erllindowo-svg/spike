"use client";

import { LifeBuoyIcon } from "lucide-react";
import Link from "next/link";
import { createContext, use, useCallback, useSyncExternalStore } from "react";

import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";

import {
  supportViewCookieValue,
  supportViewFromCookieHeader,
} from "./support-view-cookie";

// Vista de suporte: mostra o que só interessa a quem dá suporte (request_id,
// callback_id, o canal de entrega, o Diagnóstico de webhooks). A preferência
// fica num cookie deste navegador (support-view-cookie.ts). É um filtro de
// interface, não uma proteção: quem tem o endereço abre qualquer página, com
// a vista ligada ou não.
//
// useSyncExternalStore lê o cookie sem divergir do HTML do servidor: no
// servidor e na hidratação vale o valor que o layout leu do mesmo cookie
// (SupportViewProvider). No modo "db", os dois coincidem e a página já nasce
// com a vista certa. Na demonstração, as páginas são pré-renderizadas sem
// cookie: a página nasce com a vista desligada e liga logo depois.

const CHANGE_EVENT = "raio-x:vista-suporte";

const ServerValue = createContext(false);

export function SupportViewProvider({
  initial,
  children,
}: {
  initial: boolean;
  children: React.ReactNode;
}) {
  return <ServerValue value={initial}>{children}</ServerValue>;
}

// Usado quando o navegador bloqueia cookies: a vista funciona, mas não
// sobrevive à recarga.
let memoryValue = false;

function read(): boolean {
  if (!navigator.cookieEnabled) return memoryValue;
  return supportViewFromCookieHeader(document.cookie);
}

function subscribe(onChange: () => void): () => void {
  // O evento próprio avisa as mudanças feitas nesta aba. Cookie não tem
  // evento entre abas: a outra aba relê ao voltar a ficar visível.
  window.addEventListener(CHANGE_EVENT, onChange);
  document.addEventListener("visibilitychange", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    document.removeEventListener("visibilitychange", onChange);
  };
}

export function useSupportView(): [boolean, (enabled: boolean) => void] {
  const serverValue = use(ServerValue);
  const enabled = useSyncExternalStore(subscribe, read, () => serverValue);
  const setEnabled = useCallback((next: boolean) => {
    memoryValue = next;
    document.cookie = supportViewCookieValue(next);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);
  return [enabled, setEnabled];
}

// Mostra o conteúdo só com a vista de suporte ligada.
export function SupportOnly({ children }: { children: React.ReactNode }) {
  const [enabled] = useSupportView();
  return enabled ? children : null;
}

// Página inteira da vista de suporte (o Diagnóstico de webhooks). Desligada,
// explica o que é e onde ligar, em vez de esconder a página sem aviso.
export function SupportViewGate({ children }: { children: React.ReactNode }) {
  const [enabled] = useSupportView();
  if (enabled) return children;
  return (
    <EmptyState
      icon={LifeBuoyIcon}
      title="Página da vista de suporte"
      description="Esta página mostra as entregas técnicas de webhook da JUDIT e serve para investigar falhas. Ligue a vista de suporte em Configurações para vê-la."
      action={
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href="/configuracoes" />}
        >
          Ir para Configurações
        </Button>
      }
      className="rounded-xl border bg-card"
    />
  );
}
