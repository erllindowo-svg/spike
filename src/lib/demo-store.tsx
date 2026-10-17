"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  useState,
} from "react";

import type { ActivityItem } from "@/features/activity/types";
import {
  markAlertReadAction,
  markAllAlertsReadAction,
} from "@/features/alerts/actions";
import type { AlertView } from "@/features/alerts/types";
import type { DocumentType } from "@/features/parties/documents";
import type { Party } from "@/features/parties/types";
import { formatCnj } from "@/features/processes/cnj";
import type { Lawsuit } from "@/features/processes/types";
import type { QueryView } from "@/features/queries/types";
import { trackingModeFor } from "@/features/queries/modes";
import { subjectHref } from "@/features/subjects/subjects";
import { formatSearchKey } from "@/features/trackings/format";
import {
  getTrackingDisplayState,
  isTrackingClosed,
  searchTypeLabels,
  type NewTrackingInput,
  type Tracking,
} from "@/features/trackings/types";
import {
  createTrackingAction,
  type CreateTrackingActionResult,
} from "@/features/trackings/actions";
import type { WebhookEventView } from "@/features/webhooks/types";

import type { DataSource, DemoState } from "./data";

// Estado da interface no navegador. O nome vem da demonstração, mas o store
// atende aos dois modos de DATA_SOURCE (ver src/lib/data.ts):
//
// - "demo": tudo fica em memória; recarregar a página restaura os dados
//   iniciais. Nada é persistido nem enviado à JUDIT.
// - "db": monitoramentos, alertas e eventos de webhook vêm do MongoDB e são
//   lidos direto do `initialState` do servidor, sem cópia no navegador. Cada
//   server action que muda esses dados chama refresh(): o layout é
//   renderizado de novo no servidor, relê o banco e entrega as listas novas.
//   Simular webhook e restaurar só existem na demonstração.
//
// Na demonstração, uma parte adicionada pelo usuário também fica só na
// memória da aba (addDemoParty); a página dela é desenhada no navegador
// (DemoPartyPage), porque o servidor não a conhece.

export type SimulationScenario =
  | "lawsuit_movement"
  | "new_lawsuit"
  | "unknown_reference"
  | "duplicate_delivery";

type Action =
  | { type: "reset"; state: DemoState }
  | { type: "addTracking"; tracking: Tracking; activity: ActivityItem }
  | { type: "setTrackingStatus"; id: string; status: string }
  | { type: "addActivity"; activity: ActivityItem }
  | { type: "markAlertRead"; id: string }
  | { type: "markAllAlertsRead"; trackingId?: string }
  | { type: "receiveEvent"; event: WebhookEventView; activity: ActivityItem }
  | { type: "registerDuplicate"; eventId: string }
  | { type: "patchEvent"; eventId: string; patch: Partial<WebhookEventView> }
  | {
      type: "finishProcessing";
      eventId: string;
      patch: Partial<WebhookEventView>;
      alert: AlertView | null;
      activity: ActivityItem;
    };

function reducer(state: DemoState, action: Action): DemoState {
  switch (action.type) {
    case "reset":
      return action.state;
    case "addTracking":
      return {
        ...state,
        trackings: [action.tracking, ...state.trackings],
        activity: [action.activity, ...state.activity],
      };
    case "setTrackingStatus":
      return {
        ...state,
        trackings: state.trackings.map((t) =>
          t.id === action.id
            ? { ...t, status: action.status, updatedAt: new Date() }
            : t,
        ),
      };
    case "addActivity":
      return { ...state, activity: [action.activity, ...state.activity] };
    case "markAlertRead":
      return {
        ...state,
        alerts: state.alerts.map((a) =>
          a.id === action.id && !a.readAt ? { ...a, readAt: new Date() } : a,
        ),
      };
    case "markAllAlertsRead": {
      const now = new Date();
      return {
        ...state,
        alerts: state.alerts.map((a) =>
          a.readAt ||
          (action.trackingId !== undefined &&
            a.trackingId !== action.trackingId)
            ? a
            : { ...a, readAt: now },
        ),
      };
    }
    case "receiveEvent":
      return {
        ...state,
        webhookEvents: [action.event, ...state.webhookEvents],
        activity: [action.activity, ...state.activity],
      };
    case "registerDuplicate":
      return {
        ...state,
        webhookEvents: state.webhookEvents.map((e) =>
          e.id === action.eventId
            ? { ...e, duplicateDeliveries: e.duplicateDeliveries + 1 }
            : e,
        ),
      };
    case "patchEvent":
      return {
        ...state,
        webhookEvents: state.webhookEvents.map((e) =>
          e.id === action.eventId ? { ...e, ...action.patch } : e,
        ),
      };
    case "finishProcessing":
      return {
        ...state,
        webhookEvents: state.webhookEvents.map((e) =>
          e.id === action.eventId ? { ...e, ...action.patch } : e,
        ),
        alerts: action.alert ? [action.alert, ...state.alerts] : state.alerts,
        activity: [action.activity, ...state.activity],
      };
  }
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
}

// A server action não respondeu (servidor reiniciando, rede). A operação pode
// ter sido concluída no servidor mesmo assim.
export const SERVER_UNREACHABLE =
  "Sem resposta do servidor da aplicação. A operação pode ter sido concluída: recarregue a página e confira antes de repetir.";

const trackingErrorMessages = {
  duplicate: "Já existe um monitoramento ativo para este identificador.",
  invalid_input: "Os dados do monitoramento são inválidos.",
  unavailable: "Gravação no banco indisponível no modo de demonstração.",
  error: "Não foi possível salvar no banco. Tente novamente em instantes.",
} as const;

function trackingActivity(
  tracking: Tracking,
  company: Party | null,
  title: string,
): ActivityItem {
  const identifier = `${searchTypeLabels[tracking.searchType]} ${formatSearchKey(
    tracking.searchType,
    tracking.searchKey,
  )}`;
  return {
    id: newId(),
    kind: "tracking_created",
    title,
    description: company?.name ? `${identifier} · ${company.name}` : identifier,
    occurredAt: tracking.createdAt,
    partyId: tracking.partyId,
    href: subjectHref(tracking.searchType, tracking.searchKey),
  };
}

// `notice` resume o que aconteceu com o envio à JUDIT (só no modo "db").
export type AddTrackingResult =
  | {
      ok: true;
      tracking: Tracking;
      notice?: { sent: boolean; message: string };
    }
  | { ok: false; error: string };

export type SimulationResult =
  | { ok: true; eventId: string; duplicate: boolean }
  | { ok: false; error: string };

type DemoStore = DemoState & {
  dataSource: DataSource;
  parties: Party[];
  lawsuits: Lawsuit[];
  // Histórico de consultas (síncronas e assíncronas), lido do servidor a
  // cada navegação. A barra de pesquisa monta os assuntos com ele.
  queries: QueryView[];
  getParty: (id: string | null) => Party | null;
  // Só na demonstração (no modo "db", addPartyAction grava no banco).
  // Devolve a parte já existente quando o documento está na lista.
  addDemoParty: (documentType: DocumentType, document: string) => Party;
  addTracking: (input: NewTrackingInput) => Promise<AddTrackingResult>;
  setTrackingPaused: (id: string, paused: boolean) => void;
  markAlertRead: (id: string) => void;
  // Resolve com a mensagem de erro, ou null se deu certo.
  // Sem argumento, todos; com o id de um monitoramento, só os dele.
  markAllAlertsRead: (trackingId?: string) => Promise<string | null>;
  simulateWebhookEvent: (scenario: SimulationScenario) => SimulationResult;
  reset: () => void;
};

const DemoStoreContext = createContext<DemoStore | null>(null);

const PROCESSING_DELAY_MS = 1500;

export function DemoStoreProvider({
  dataSource,
  initialState,
  parties,
  lawsuits,
  queries,
  children,
}: {
  dataSource: DataSource;
  initialState: DemoState;
  parties: Party[];
  lawsuits: Lawsuit[];
  queries: QueryView[];
  children: React.ReactNode;
}) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [addedParties, setAddedParties] = useState<Party[]>([]);
  // No modo "db", as listas são as do servidor (ver o comentário no topo).
  // O reducer só guarda os dados da demonstração e a atividade.
  const fromServer = dataSource === "db";
  const trackings = fromServer ? initialState.trackings : state.trackings;
  const alerts = fromServer ? initialState.alerts : state.alerts;
  const webhookEvents = fromServer
    ? initialState.webhookEvents
    : state.webhookEvents;
  const allParties = useMemo(
    () =>
      fromServer || addedParties.length === 0
        ? parties
        : [...addedParties, ...parties].sort((a, b) =>
            (a.name ?? a.document).localeCompare(b.name ?? b.document, "pt-BR"),
          ),
    [fromServer, parties, addedParties],
  );

  const companiesById = useMemo(
    () => new Map(allParties.map((c) => [c.id, c])),
    [allParties],
  );

  const addDemoParty = useCallback(
    (documentType: DocumentType, document: string): Party => {
      const existing = allParties.find(
        (p) => p.documentType === documentType && p.document === document,
      );
      if (existing) return existing;
      const now = new Date();
      const party: Party = {
        id: newId(),
        documentType,
        document,
        name: null,
        tradeName: null,
        registrationStatus: null,
        createdAt: now,
        updatedAt: now,
      };
      setAddedParties((current) => [party, ...current]);
      return party;
    },
    [allParties],
  );
  const getParty = useCallback(
    (id: string | null) => (id ? (companiesById.get(id) ?? null) : null),
    [companiesById],
  );

  const addTracking = useCallback(
    async (input: NewTrackingInput): Promise<AddTrackingResult> => {
      if (dataSource === "db") {
        // A regra de duplicidade e a validação ficam no servidor (banco). O
        // monitoramento novo chega à lista pelo refresh() da action.
        let result: CreateTrackingActionResult;
        try {
          result = await createTrackingAction(
            input.searchType === "cnj"
              ? {
                  searchType: "cnj",
                  searchKey: input.searchKey,
                  recurrenceDays: input.recurrenceDays,
                  stepTerms: input.stepTerms,
                }
              : {
                  searchType: input.searchType,
                  searchKey: input.searchKey,
                  recurrenceDays: input.recurrenceDays,
                },
          );
        } catch {
          return { ok: false, error: SERVER_UNREACHABLE };
        }
        if (!result.ok) {
          return { ok: false, error: trackingErrorMessages[result.reason] };
        }
        const sent = result.outcome === "confirmed";
        dispatch({
          type: "addActivity",
          activity: trackingActivity(
            result.tracking,
            getParty(result.tracking.partyId),
            sent
              ? "Monitoramento criado na JUDIT"
              : "Monitoramento reservado no banco",
          ),
        });
        return {
          ok: true,
          tracking: result.tracking,
          notice: { sent, message: result.message },
        };
      }

      const duplicate = state.trackings.find(
        (t) =>
          t.searchType === input.searchType &&
          t.searchKey === input.searchKey &&
          !isTrackingClosed(t),
      );
      if (duplicate) {
        return {
          ok: false,
          error: "Já existe um monitoramento para este identificador.",
        };
      }

      const now = new Date();
      const tracking: Tracking = {
        id: newId(),
        // Sem ID da JUDIT: nenhum monitoramento real foi criado. A criação
        // "confirmada" e o status "created" são simulados.
        juditTrackingId: null,
        partyId: input.partyId ?? null,
        mode: trackingModeFor(input.searchType),
        searchType: input.searchType,
        searchKey: input.searchKey,
        creation: "confirmed",
        creationError: null,
        status: "created",
        recurrenceDays: input.recurrenceDays,
        hourRange: null,
        delivery: "webhook",
        stepTerms: input.stepTerms ?? null,
        createdAt: now,
        updatedAt: now,
        lastCheckedAt: null,
      };
      dispatch({
        type: "addTracking",
        tracking,
        activity: trackingActivity(
          tracking,
          getParty(tracking.partyId),
          "Monitoramento criado (demonstração)",
        ),
      });
      return { ok: true, tracking };
    },
    [dataSource, state.trackings, getParty],
  );

  // Só para a demonstração. No modo "db", pausar chama a JUDIT
  // (pauseTrackingAction em src/features/trackings/actions.ts).
  const setTrackingPaused = useCallback(
    (id: string, paused: boolean) => {
      if (dataSource === "db") return;
      dispatch({
        type: "setTrackingStatus",
        id,
        status: paused ? "paused" : "updated",
      });
    },
    [dataSource],
  );

  // No modo "db", a leitura é gravada no banco; o alerta aparece como lido
  // quando o refresh() da action entrega a lista nova. Uma falha só deixa o
  // alerta como não lido.
  const markAlertRead = useCallback(
    (id: string) => {
      if (dataSource === "db") {
        markAlertReadAction(id).catch(() => {});
        return;
      }
      dispatch({ type: "markAlertRead", id });
    },
    [dataSource],
  );
  const markAllAlertsRead = useCallback(
    async (trackingId?: string): Promise<string | null> => {
      if (dataSource === "db") {
        try {
          const result = await markAllAlertsReadAction(trackingId);
          return result.ok ? null : result.message;
        } catch {
          return SERVER_UNREACHABLE;
        }
      }
      dispatch({ type: "markAllAlertsRead", trackingId });
      return null;
    },
    [dataSource],
  );

  const simulateWebhookEvent = useCallback(
    (scenario: SimulationScenario): SimulationResult => {
      if (dataSource === "db") {
        return {
          ok: false,
          error: "A simulação de webhooks só existe no modo de demonstração.",
        };
      }
      const current = state;

      if (scenario === "duplicate_delivery") {
        const original = current.webhookEvents.find(
          (e) => e.callbackId && e.processingStatus === "processed",
        );
        if (!original) {
          return {
            ok: false,
            error: "Não há evento processado para simular uma reentrega.",
          };
        }
        dispatch({ type: "registerDuplicate", eventId: original.id });
        return { ok: true, eventId: original.id, duplicate: true };
      }

      const wantedType = scenario === "new_lawsuit" ? "cnpj" : "cnj";
      const tracking =
        current.trackings.find(
          (t) =>
            t.searchType === wantedType &&
            t.juditTrackingId &&
            getTrackingDisplayState(t) === "active",
        ) ?? null;

      const referenceId =
        scenario === "unknown_reference" || !tracking
          ? newId()
          : tracking.juditTrackingId;
      const lawsuit =
        tracking?.searchType === "cnj"
          ? (lawsuits.find((l) => l.cnj === tracking.searchKey) ?? null)
          : (lawsuits.find((l) => l.partyId === tracking?.partyId) ?? null);
      const callbackId = newId();
      const receivedAt = new Date();
      const step =
        scenario === "new_lawsuit"
          ? undefined
          : "Movimentação fictícia gerada pela simulação";

      const event: WebhookEventView = {
        id: newId(),
        callbackId,
        eventType: "response_created",
        referenceType: "tracking",
        referenceId,
        payload: {
          user_id: "00000000-0000-4000-8000-0000000000de",
          callback_id: callbackId,
          event_type: "response_created",
          reference_type: "tracking",
          reference_id: referenceId,
          payload: {
            request_id: newId(),
            response_type: "lawsuit",
            response_data: {
              code: lawsuit ? formatCnj(lawsuit.cnj) : null,
              tribunal_acronym: lawsuit?.tribunal ?? null,
              ...(step && { last_step: { content: step } }),
            },
          },
          _demo:
            "Evento simulado localmente; nada foi enviado ou recebido da JUDIT.",
        },
        receivedAt,
        processingStatus: "pending",
        processingStartedAt: null,
        processedAt: null,
        processingNote: null,
        processingError: null,
        duplicateDeliveries: 0,
        alertIds: [],
      };

      dispatch({
        type: "receiveEvent",
        event,
        activity: {
          id: newId(),
          kind: "webhook_received",
          title: "Webhook recebido (simulado)",
          description: "response_created aguardando processamento",
          occurredAt: receivedAt,
          partyId: tracking?.partyId ?? null,
          href: "/webhooks",
        },
      });

      setTimeout(
        () =>
          dispatch({
            type: "patchEvent",
            eventId: event.id,
            patch: { processingStatus: "processing" },
          }),
        PROCESSING_DELAY_MS / 2,
      );

      setTimeout(() => {
        const processedAt = new Date();
        const failed = scenario === "unknown_reference" || !tracking;

        if (failed) {
          dispatch({
            type: "finishProcessing",
            eventId: event.id,
            patch: {
              processingStatus: "failed",
              processedAt,
              processingError:
                "Referência desconhecida: nenhum monitoramento local corresponde ao reference_id recebido.",
            },
            alert: null,
            activity: {
              id: newId(),
              kind: "processing_failed",
              title: "Falha no processamento de evento (simulado)",
              description:
                "reference_id sem monitoramento local correspondente",
              occurredAt: processedAt,
              partyId: null,
              href: "/webhooks",
            },
          });
          return;
        }

        const isNewLawsuit = scenario === "new_lawsuit";
        const alert: AlertView = {
          id: newId(),
          type: isNewLawsuit ? "new_lawsuit" : "lawsuit_movement",
          partyId: tracking.partyId,
          webhookEventId: event.id,
          trackingId: tracking.id,
          lawsuitCnj: lawsuit?.cnj ?? null,
          dedupeKey: `demo:${event.id}`,
          title: isNewLawsuit
            ? "Novo processo identificado"
            : "Nova movimentação processual",
          description: isNewLawsuit
            ? "Processo fictício associado ao CNPJ monitorado (simulação)."
            : "Movimentação fictícia gerada pela simulação.",
          createdAt: processedAt,
          readAt: null,
        };
        dispatch({
          type: "finishProcessing",
          eventId: event.id,
          patch: {
            processingStatus: "processed",
            processedAt,
            alertIds: [alert.id],
          },
          alert,
          activity: {
            id: newId(),
            kind: isNewLawsuit ? "new_lawsuit" : "lawsuit_movement",
            title: isNewLawsuit
              ? "Novo processo identificado (simulado)"
              : "Movimentação processual recebida (simulada)",
            description: lawsuit
              ? `${formatCnj(lawsuit.cnj)} · ${lawsuit.tribunal}`
              : "Processo não identificado",
            occurredAt: processedAt,
            partyId: tracking.partyId,
            href: "/informacoes",
          },
        });
      }, PROCESSING_DELAY_MS);

      return { ok: true, eventId: event.id, duplicate: false };
    },
    [dataSource, state, lawsuits],
  );

  const reset = useCallback(() => {
    if (dataSource === "db") return;
    dispatch({ type: "reset", state: initialState });
    setAddedParties([]);
  }, [dataSource, initialState]);

  const value = useMemo<DemoStore>(
    () => ({
      ...state,
      trackings,
      alerts,
      webhookEvents,
      dataSource,
      parties: allParties,
      lawsuits,
      queries,
      getParty,
      addDemoParty,
      addTracking,
      setTrackingPaused,
      markAlertRead,
      markAllAlertsRead,
      simulateWebhookEvent,
      reset,
    }),
    [
      state,
      trackings,
      alerts,
      webhookEvents,
      dataSource,
      allParties,
      lawsuits,
      queries,
      getParty,
      addDemoParty,
      addTracking,
      setTrackingPaused,
      markAlertRead,
      markAllAlertsRead,
      simulateWebhookEvent,
      reset,
    ],
  );

  return (
    <DemoStoreContext.Provider value={value}>
      {children}
    </DemoStoreContext.Provider>
  );
}

export function useDemoStore(): DemoStore {
  const store = useContext(DemoStoreContext);
  if (!store) {
    throw new Error("useDemoStore deve ser usado dentro de DemoStoreProvider.");
  }
  return store;
}
