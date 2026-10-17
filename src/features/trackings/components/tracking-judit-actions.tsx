"use client";

import {
  ListIcon,
  PauseIcon,
  PlayIcon,
  RefreshCwIcon,
  SendIcon,
  Trash2Icon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { LawsuitSheet } from "@/features/processes/components/lawsuit-sheet";
import type { Lawsuit } from "@/features/processes/types";
import { ResponsesSummaryView } from "@/features/queries/components/responses-summary-view";
import { TRACKING_MODES } from "@/features/queries/modes";
import type { ResponsesSummary } from "@/features/queries/responses";
import { SERVER_UNREACHABLE } from "@/lib/app-store";

import {
  deleteTrackingAction,
  discardTrackingAction,
  pauseTrackingAction,
  reconcileTrackingAction,
  refreshTrackingAction,
  resumeTrackingAction,
  sendTrackingAction,
  trackingResultsAction,
  type TrackingActionResult,
} from "../actions";
import { formatSearchKey } from "../format";
import { getTrackingDisplayState, type Tracking } from "../types";

// Ações sobre monitoramentos reais. Cada item chama uma server
// action, que fala com a JUDIT, grava o resultado no banco e chama
// refresh(): a lista da tela é relida do MongoDB (ver app-store.tsx).
//
// Toda chamada tem try/catch: se o servidor da aplicação não responder
// (reiniciando, rede), a promessa rejeita. Sem o catch, o erro iria para a
// tela de erro da rota e o aviso "Falando com a JUDIT…" ficaria preso.

export function JuditTrackingMenuItems({
  tracking,
  onRequestDelete,
  onRequestResults,
}: {
  tracking: Tracking;
  onRequestDelete: (tracking: Tracking) => void;
  onRequestResults: (tracking: Tracking) => void;
}) {
  const [, startTransition] = useTransition();
  const state = getTrackingDisplayState(tracking);

  function run(
    action: (id: string) => Promise<TrackingActionResult>,
    errorTitle: string,
  ) {
    const toastId = toast.loading("Falando com a JUDIT…");
    startTransition(async () => {
      try {
        const result = await action(tracking.id);
        if (!result.ok) {
          toast.error(errorTitle, { id: toastId, description: result.message });
          return;
        }
        toast.success(result.message, { id: toastId });
      } catch {
        toast.error(errorTitle, {
          id: toastId,
          description: SERVER_UNREACHABLE,
        });
      }
    });
  }

  function discard() {
    startTransition(async () => {
      try {
        const result = await discardTrackingAction(tracking.id);
        if (!result.ok) {
          toast.error("Reserva não descartada", {
            description: result.message,
          });
          return;
        }
        toast.success("Reserva descartada. Nada foi enviado à JUDIT.");
      } catch {
        toast.error("Reserva não descartada", {
          description: SERVER_UNREACHABLE,
        });
      }
    });
  }

  if (state === "not_sent") {
    return (
      <>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => run(sendTrackingAction, "Monitoramento não enviado")}
        >
          <SendIcon />
          Enviar à JUDIT
        </DropdownMenuItem>
        <DropdownMenuItem onClick={discard}>
          <XIcon />
          Descartar reserva
        </DropdownMenuItem>
      </>
    );
  }

  if (state === "uncertain") {
    return (
      <>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => run(reconcileTrackingAction, "Envio não conferido")}
        >
          <TriangleAlertIcon />
          Conferir na JUDIT
        </DropdownMenuItem>
      </>
    );
  }

  if (state === "rejected" || !tracking.juditTrackingId) return null;

  const deleted = tracking.status === "deleted";
  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        onClick={() => run(refreshTrackingAction, "Status não atualizado")}
      >
        <RefreshCwIcon />
        Atualizar status
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => onRequestResults(tracking)}>
        <ListIcon />
        Ver resultados
      </DropdownMenuItem>
      {!deleted &&
        (state === "paused" ? (
          <DropdownMenuItem
            onClick={() => run(resumeTrackingAction, "Não foi reativado")}
          >
            <PlayIcon />
            Reativar na JUDIT
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            onClick={() => run(pauseTrackingAction, "Não foi pausado")}
          >
            <PauseIcon />
            Pausar na JUDIT
          </DropdownMenuItem>
        ))}
      {!deleted && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => onRequestDelete(tracking)}
          >
            <Trash2Icon />
            Excluir na JUDIT…
          </DropdownMenuItem>
        </>
      )}
    </>
  );
}

// Excluir é definitivo, por isso pede confirmação (pausar não pede).
export function DeleteTrackingDialog({
  tracking,
  onOpenChange,
}: {
  tracking: Tracking | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [deleting, startTransition] = useTransition();

  function confirm() {
    if (!tracking) return;
    startTransition(async () => {
      try {
        const result = await deleteTrackingAction(tracking.id);
        if (!result.ok) {
          toast.error("Monitoramento não excluído", {
            description: result.message,
          });
          return;
        }
        onOpenChange(false);
        toast.success(result.message);
      } catch {
        toast.error("Monitoramento não excluído", {
          description: SERVER_UNREACHABLE,
        });
      }
    });
  }

  return (
    <Dialog open={!!tracking} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir o monitoramento na JUDIT?</DialogTitle>
          <DialogDescription>
            {tracking &&
              `${formatSearchKey(tracking.searchType, tracking.searchKey)}. `}
            A exclusão é definitiva: as execuções futuras são canceladas e o
            monitoramento não pode ser reativado. Para interromper só por um
            tempo, use “Pausar na JUDIT”.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={confirm} disabled={deleting}>
            {deleting && <Spinner data-icon="inline-start" />}
            Excluir definitivamente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Resultados das execuções (GET /responses/tracking/{tracking_id}). Nada é
// gravado.
//
// A busca sai do clique em "Ver resultados" (open), não de um useEffect ao
// abrir o painel: em desenvolvimento, o Strict Mode roda cada efeito duas
// vezes, o que daria duas chamadas à JUDIT, possivelmente cobradas.
type ResultsView = {
  tracking: Tracking;
  results: ResponsesSummary | null;
  error: string | null;
};

export function useTrackingResults() {
  const [view, setView] = useState<ResultsView | null>(null);

  async function open(tracking: Tracking) {
    const opened: ResultsView = { tracking, results: null, error: null };
    setView(opened);
    // Só preenche o painel se ele ainda mostra esta abertura: o usuário pode
    // ter fechado ou aberto outro monitoramento enquanto a JUDIT respondia.
    const fill = (patch: Partial<ResultsView>) =>
      setView((current) =>
        current === opened ? { ...opened, ...patch } : current,
      );
    try {
      const result = await trackingResultsAction(tracking.id);
      fill(result.ok ? { results: result.results } : { error: result.message });
    } catch {
      fill({ error: SERVER_UNREACHABLE });
    }
  }

  return { view, open, close: () => setView(null) };
}

export function TrackingResultsSheet({
  view,
  onOpenChange,
}: {
  view: ResultsView | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={!!view} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 data-[side=right]:sm:max-w-3xl">
        {view && <TrackingResults key={view.tracking.id} {...view} />}
      </SheetContent>
    </Sheet>
  );
}

function TrackingResults({ tracking, results, error }: ResultsView) {
  const [selected, setSelected] = useState<Lawsuit | null>(null);

  return (
    <>
      <SheetHeader className="border-b">
        <SheetTitle>{TRACKING_MODES[tracking.mode].label}</SheetTitle>
        <SheetDescription>
          {formatSearchKey(tracking.searchType, tracking.searchKey)} · o que as
          execuções na JUDIT encontraram. A primeira execução acontece em até 24
          horas depois da criação.
        </SheetDescription>
      </SheetHeader>
      <div className="flex flex-col gap-4 overflow-y-auto p-4">
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : results ? (
          <ResponsesSummaryView
            results={results}
            onSelectLawsuit={setSelected}
          />
        ) : (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner /> Consultando a JUDIT…
          </p>
        )}
      </div>
      <LawsuitSheet
        lawsuit={selected}
        onOpenChange={(open) => !open && setSelected(null)}
      />
    </>
  );
}
