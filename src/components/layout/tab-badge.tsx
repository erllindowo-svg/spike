"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { countUnreadAlertsAction } from "@/features/alerts/actions";
import { useDemoStore } from "@/lib/demo-store";

// Aviso na aba do navegador (círculo 6): com alertas não lidos, o ícone da
// aba ganha um ponto vermelho e o título começa com o número ("(2) …").
// Vale com a aba aberta, mesmo em segundo plano; não pede permissão nem
// precisa de configuração. Notificação do sistema com a aba fechada (Web
// Push) foi descartada: exigiria chaves e um passo a mais na instalação.
//
// Um alerta novo nasce no servidor (webhook), sem a aba saber. Por isso, de
// minuto em minuto, a aba pergunta ao servidor quantos há (uma contagem no
// MongoDB, sem a JUDIT); se mudou, relê a página, e o sino e a aba se
// atualizam juntos. Navegadores espaçam os timers de abas em segundo plano
// para no mínimo um por minuto, que é o ritmo daqui.

const CHECK_EVERY_MS = 60_000;
const PREFIX = /^\(\d+\+?\) /;

export function TabBadge() {
  const { alerts, dataSource } = useDemoStore();
  const unread = alerts.filter((a) => !a.readAt).length;
  const router = useRouter();
  const pathname = usePathname();
  const original = useRef<string | null>(null);

  // A contagem no servidor, só no modo banco.
  useEffect(() => {
    if (dataSource !== "db") return;
    let stopped = false;
    const timer = window.setInterval(async () => {
      let count: number | null = null;
      try {
        count = await countUnreadAlertsAction();
      } catch {
        return;
      }
      if (!stopped && count !== null && count !== unread) router.refresh();
    }, CHECK_EVERY_MS);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [dataSource, unread, router]);

  // O número no título. O Next troca o título a cada página; o observador
  // devolve o número quando isso acontece.
  useEffect(() => {
    const label = unread > 99 ? "99+" : String(unread);
    const apply = () => {
      const bare = document.title.replace(PREFIX, "");
      const next = unread > 0 ? `(${label}) ${bare}` : bare;
      if (document.title !== next) document.title = next;
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.head, {
      subtree: true,
      childList: true,
      characterData: true,
    });
    return () => observer.disconnect();
  }, [unread, pathname]);

  // O ponto vermelho no ícone: o ícone original desenhado num canvas, com o
  // ponto por cima. Sem não lidos, volta o original.
  useEffect(() => {
    const links = [
      ...document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]'),
    ];
    if (links.length === 0) return;
    original.current ??= links[0].href;
    const source = original.current;
    if (unread === 0) {
      for (const link of links) link.href = source;
      return;
    }
    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      if (cancelled) return;
      const size = 64;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext("2d");
      if (!context) return;
      context.drawImage(image, 0, 0, size, size);
      context.beginPath();
      context.arc(size - 16, 16, 14, 0, 2 * Math.PI);
      context.fillStyle = "#dc2626";
      context.fill();
      context.lineWidth = 4;
      context.strokeStyle = "#ffffff";
      context.stroke();
      const href = canvas.toDataURL("image/png");
      for (const link of links) link.href = href;
    };
    image.src = source;
    return () => {
      cancelled = true;
    };
  }, [unread, pathname]);

  return null;
}
