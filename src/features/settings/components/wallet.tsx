"use client";

import { RefreshCwIcon, WalletIcon } from "lucide-react";
import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import {
  billedCallsSinceAction,
  readJuditAccountAction,
  type AccountResult,
} from "@/features/settings/account-actions";
import { SERVER_UNREACHABLE } from "@/lib/app-store";
import { formatTime } from "@/lib/format";

import { AccountReading } from "./account-reading";

// A carteira do topo (círculo 5). Abrir lê a conta na JUDIT de novo; nada é
// lido sozinho depois de cada ação (a documentação não diz se a leitura é
// cobrada; pergunta IK). O aviso de gasto vem do contador do próprio app:
// a cada NOTICE_EVERY chamadas cobradas desde o último aviso, um toast.

const NOTICE_EVERY = 10;
const CHECK_EVERY_MS = 60_000;
// Preferência de quem vê, no navegador: só marca até onde já se avisou.
const LAST_NOTICE_KEY = "raio-x:wallet-last-notice";

type Reading = { result: AccountResult; at: Date };

export function WalletButton() {
  const [open, setOpen] = useState(false);
  const [reading, setReading] = useState<Reading | null>(null);
  const [loading, startLoading] = useTransition();

  const read = useCallback(() => {
    startLoading(async () => {
      let result: AccountResult;
      try {
        result = await readJuditAccountAction();
      } catch {
        result = { ok: false, message: SERVER_UNREACHABLE };
      }
      setReading({ result, at: new Date() });
    });
  }, []);

  useBilledCallsNotice(() => {
    setOpen(true);
    read();
  });

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) read();
      }}
    >
      <PopoverTrigger
        render={<Button variant="ghost" size="icon" aria-label="Carteira" />}
      >
        <WalletIcon />
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-80 flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <PopoverTitle className="flex items-center gap-2">
            Carteira
          </PopoverTitle>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Ler de novo"
            disabled={loading}
            onClick={read}
          >
            {loading ? <Spinner /> : <RefreshCwIcon />}
          </Button>
        </div>
        {loading && !reading ? (
          <p className="text-sm text-muted-foreground">Lendo na JUDIT…</p>
        ) : reading ? (
          <>
            {reading.result.ok ? (
              <AccountReading result={reading.result} />
            ) : (
              <p className="text-sm text-destructive">
                {reading.result.message}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Lido às {formatTime(reading.at)}
              {" na JUDIT."}
            </p>
          </>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

// O contador: de minuto em minuto, com a página visível, pergunta ao
// servidor quantas chamadas cobradas o app fez desde o último aviso (uma
// contagem no MongoDB, sem a JUDIT).
function useBilledCallsNotice(onOpenWallet: () => void) {
  useEffect(() => {
    let since = readLastNotice();
    let stopped = false;

    async function check() {
      if (stopped || document.visibilityState !== "visible") return;
      let count = 0;
      try {
        count = await billedCallsSinceAction(since.toISOString());
      } catch {
        return;
      }
      if (stopped || count < NOTICE_EVERY) return;
      toast.info(`${count} consultas cobradas desde o último aviso`, {
        description: "Veja na carteira quanto resta no ciclo.",
        action: { label: "Abrir carteira", onClick: onOpenWallet },
      });
      since = new Date();
      writeLastNotice(since);
    }

    void check();
    const timer = window.setInterval(check, CHECK_EVERY_MS);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
    // onOpenWallet muda a cada renderização; o aviso usa a versão do
    // momento em que foi criado, o que basta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

// Sem nada guardado (primeira vez, janela anônima, armazenamento
// bloqueado), conta a partir de agora.
function readLastNotice(): Date {
  try {
    const saved = window.localStorage.getItem(LAST_NOTICE_KEY);
    const date = saved ? new Date(saved) : null;
    if (date && !Number.isNaN(date.getTime())) return date;
  } catch {}
  const now = new Date();
  writeLastNotice(now);
  return now;
}

function writeLastNotice(date: Date) {
  try {
    window.localStorage.setItem(LAST_NOTICE_KEY, date.toISOString());
  } catch {}
}
