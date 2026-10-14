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
import { useEffect, useState, useTransition } from "react";
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
import { useDemoStore } from "@/lib/demo-store";

import {
  deleteTrackingAction,
  discardTrackingAction,
  pauseTrackingAction,
  refreshTrackingAction,
  resumeTrackingAction,
  sendTrackingAction,
  trackingResultsAction,
  type TrackingActionResult,
} from "../actions";
import { formatSearchKey } from "../format";
import { getTrackingDisplayState, type Tracking } from "../types";

// Ações sobre monitoramentos reais (modo "db"). Cada item chama uma server
// action, que fala com a JUDIT e devolve o monitoramento atualizado; o
// estado da tela é substituído pelo que ficou gravado no banco.

export function JuditTrackingMenuItems({
  tracking,
  onRequestDelete,
  onRequestResults,
}: {
  tracking: Tracking;
  onRequestDelete: (tracking: Tracking) => void;
  onRequestResults: (tracking: Tracking) => void;
}) {
  const { replaceTracking, removeTracking } = useDemoStore();
  const [, startTransition] = useTransition();
  const state = getTrackingDisplayState(tracking);

  function run(
    action: (id: string) => Promise<TrackingActionResult>,
    errorTitle: string,
  ) {
    const toastId = toast.loading("Falando com a JUDIT…");
    startTransition(async () => {
      const result = await action(tracking.id);
      if (!result.ok) {
        toast.error(errorTitle, { id: toastId, description: result.message });
        return;
      }
      replaceTracking(result.tracking);
      toast.success(result.message, { id: toastId });
    });
  }

  function discard() {
    startTransition(async () => {
      const result = await discardTrackingAction(tracking.id);
      if (!result.ok) {
        toast.error("Reserva não descartada", { description: result.message });
        return;
      }
      removeTracking(tracking.id);
      toast.success("Reserva descartada. Nada foi enviado à JUDIT.");
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
        <DropdownMenuItem disabled>
          <TriangleAlertIcon />
          Envio incerto: conferir na JUDIT
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
  const { replaceTracking } = useDemoStore();
  const [deleting, startTransition] = useTransition();

  function confirm() {
    if (!tracking) return;
    startTransition(async () => {
      const result = await deleteTrackingAction(tracking.id);
      if (!result.ok) {
        toast.error("Monitoramento não excluído", {
          description: result.message,
        });
        return;
      }
      replaceTracking(result.tracking);
      onOpenChange(false);
      toast.success(result.message);
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

// Resultados das execuções (GET /responses/tracking/{tracking_id}). Carrega
// ao abrir; nada é gravado.
export function TrackingResultsSheet({
  tracking,
  onOpenChange,
}: {
  tracking: Tracking | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={!!tracking} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 data-[side=right]:sm:max-w-3xl">
        {tracking && <TrackingResults key={tracking.id} tracking={tracking} />}
      </SheetContent>
    </Sheet>
  );
}

function TrackingResults({ tracking }: { tracking: Tracking }) {
  const [results, setResults] = useState<ResponsesSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Lawsuit | null>(null);

  useEffect(() => {
    let cancelled = false;
    trackingResultsAction(tracking.id).then((result) => {
      if (cancelled) return;
      if (result.ok) setResults(result.results);
      else setError(result.message);
    });
    return () => {
      cancelled = true;
    };
  }, [tracking.id]);

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
