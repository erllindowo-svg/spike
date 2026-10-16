"use client";

import { LifeBuoyIcon } from "lucide-react";
import Link from "next/link";
import { useCallback, useSyncExternalStore } from "react";

import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";

// Vista de suporte: mostra o que só interessa a quem dá suporte (request_id,
// callback_id, o canal de entrega, o Diagnóstico de webhooks). A preferência
// fica no navegador (localStorage), não no servidor. É um filtro de
// interface, não uma proteção: quem tem o endereço abre qualquer página, com
// a vista ligada ou não.
//
// useSyncExternalStore lê o localStorage sem divergir do HTML do servidor:
// no servidor e na hidratação vale getServerSnapshot (desligada); logo
// depois, o React relê o valor guardado no navegador.

const STORAGE_KEY = "raio-x:vista-suporte";
const CHANGE_EVENT = "raio-x:vista-suporte";

// Usado quando o navegador bloqueia o armazenamento (janela privada,
// política do navegador): a vista funciona, mas não sobrevive à recarga.
let memoryValue = false;

function read(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "on";
  } catch {
    return memoryValue;
  }
}

function subscribe(onChange: () => void): () => void {
  // "storage" avisa as mudanças feitas em OUTRAS abas; o evento próprio
  // avisa as feitas nesta.
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

export function useSupportView(): [boolean, (enabled: boolean) => void] {
  const enabled = useSyncExternalStore(subscribe, read, () => false);
  const setEnabled = useCallback((next: boolean) => {
    memoryValue = next;
    try {
      if (next) window.localStorage.setItem(STORAGE_KEY, "on");
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Sem armazenamento: vale o memoryValue até a página recarregar.
    }
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
