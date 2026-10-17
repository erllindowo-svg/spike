"use client";

import { BellIcon, CheckIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { alertTypeStyles } from "@/features/alerts/components/alert-type-styles";
import { alertHref } from "@/features/alerts/links";
import type { AlertView } from "@/features/alerts/types";
import { useAppStore } from "@/lib/app-store";
import { formatShortDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

// O menu de alertas (círculo 7): o sino abre um painel preso a ele, com os
// alertas do mais novo para o mais antigo. Não lidos em azul, lidos em
// cinza (o histórico). Clicar num alerta marca como lido e abre a ficha do
// assunto monitorado, já com o processo do alerta aberto no painel lateral
// (?processo=, lido em subject-page.tsx). Os alertas moram só aqui; a página
// Acervo deixou de mostrá-los.

const SHOWN = 30;

export function AlertsMenu() {
  const router = useRouter();
  const { alerts, trackings, markAlertRead, markAllAlertsRead } = useAppStore();
  const [open, setOpen] = useState(false);

  const sorted = [...alerts].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );
  const unread = sorted.filter((a) => !a.readAt).length;

  function openAlert(alert: AlertView) {
    if (!alert.readAt) markAlertRead(alert.id);
    setOpen(false);
    router.push(alertHref(alert, trackings));
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="relative"
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
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-96 flex-col gap-2 p-0">
        <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
          <PopoverTitle>Alertas</PopoverTitle>
          {unread > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto px-2 py-1 text-xs"
              onClick={() => void markAllAlertsRead()}
            >
              <CheckIcon data-icon="inline-start" />
              Marcar todos como lidos
            </Button>
          )}
        </div>
        {sorted.length === 0 ? (
          <p className="px-4 pb-4 text-sm text-muted-foreground">
            Nenhum alerta por aqui. Os avisos dos monitoramentos aparecem neste
            menu.
          </p>
        ) : (
          <ul className="flex max-h-96 flex-col overflow-y-auto pb-2">
            {sorted.slice(0, SHOWN).map((alert) => {
              const { icon: Icon, className } = alertTypeStyles[alert.type];
              const isUnread = !alert.readAt;
              return (
                <li key={alert.id}>
                  <button
                    type="button"
                    onClick={() => openAlert(alert)}
                    className={cn(
                      "flex w-full items-start gap-3 px-4 py-2.5 text-left outline-none hover:bg-muted/60 focus-visible:bg-muted/60",
                      isUnread && "bg-primary/5",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full",
                        isUnread ? className : "bg-muted text-muted-foreground",
                      )}
                    >
                      <Icon className="size-3.5" aria-hidden />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span
                        className={cn(
                          "text-sm",
                          isUnread
                            ? "font-medium text-primary"
                            : "text-muted-foreground",
                        )}
                      >
                        {alert.title}
                      </span>
                      {alert.description && (
                        <span className="line-clamp-2 text-xs text-muted-foreground">
                          {alert.description}
                        </span>
                      )}
                      <time
                        dateTime={alert.createdAt.toISOString()}
                        className="text-xs text-muted-foreground tabular-nums"
                      >
                        {formatShortDateTime(alert.createdAt)}
                        {isUnread && " · não lido"}
                      </time>
                    </span>
                    {isUnread && (
                      <span
                        className="mt-2 size-2 shrink-0 rounded-full bg-primary"
                        aria-hidden
                      />
                    )}
                  </button>
                </li>
              );
            })}
            {sorted.length > SHOWN && (
              <li className="px-4 pt-2 text-xs text-muted-foreground">
                Mostrando os {SHOWN} mais recentes de{" "}
                {sorted.length.toLocaleString("pt-BR")}.
              </li>
            )}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
