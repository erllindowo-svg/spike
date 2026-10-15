"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
} from "react";

import type { ActivityItem } from "@/features/activity/types";
import type { AlertView } from "@/features/alerts/types";
import { formatCnpj } from "@/features/companies/cnpj";
import type { Company } from "@/features/companies/types";
import { formatCnj } from "@/features/processes/cnj";
import type { Lawsuit } from "@/features/processes/types";
import { trackingModeFor } from "@/features/queries/modes";
import {
  getTrackingDisplayState,
  isTrackingClosed,
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
// - "db": os monitoramentos vêm do MongoDB e são lidos direto do
//   `initialState` do servidor, sem cópia no navegador. Cada server action
//   que muda um monitoramento chama refresh(): o layout é renderizado de novo
//   no servidor, relê o banco e entrega a lista nova. Ações que dependem de
//   dados ainda não persistidos (simular webhook, restaurar) ficam
//   indisponíveis.

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
  | { type: "markAllAlertsRead" }
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
        alerts: state.alerts.map((a) => (a.readAt ? a : { ...a, readAt: now })),
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
  company: Company | null,
  title: string,
): ActivityItem {
  const identifier =
    tracking.searchType === "cnpj"
      ? `CNPJ ${formatCnpj(tracking.searchKey)}`
      : `CNJ ${formatCnj(tracking.searchKey)}`;
  return {
    id: newId(),
    kind: "tracking_created",
    title,
    description: company?.legalName
      ? `${identifier} · ${company.legalName}`
      : identifier,
    occurredAt: tracking.createdAt,
    companyId: tracking.companyId,
    href: "/monitoramentos",
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
  companies: Company[];
  lawsuits: Lawsuit[];
  getCompany: (id: string | null) => Company | null;
  addTracking: (input: NewTrackingInput) => Promise<AddTrackingResult>;
  setTrackingPaused: (id: string, paused: boolean) => void;
  markAlertRead: (id: string) => void;
  markAllAlertsRead: () => void;
  simulateWebhookEvent: (scenario: SimulationScenario) => SimulationResult;
  reset: () => void;
};

const DemoStoreContext = createContext<DemoStore | null>(null);

const PROCESSING_DELAY_MS = 1500;

export function DemoStoreProvider({
  dataSource,
  initialState,
  companies,
  lawsuits,
  children,
}: {
  dataSource: DataSource;
  initialState: DemoState;
  companies: Company[];
  lawsuits: Lawsuit[];
  children: React.ReactNode;
}) {
  const [state, dispatch] = useReducer(reducer, initialState);
  // No modo "db", a lista é a do servidor (ver o comentário no topo). O
  // reducer só guarda os monitoramentos da demonstração.
  const trackings =
    dataSource === "db" ? initialState.trackings : state.trackings;

  const companiesById = useMemo(
    () => new Map(companies.map((c) => [c.id, c])),
    [companies],
  );
  const getCompany = useCallback(
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
          result = await createTrackingAction({
            searchType: input.searchType,
            searchKey: input.searchKey,
            recurrenceDays: input.recurrenceDays,
          });
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
            getCompany(result.tracking.companyId),
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
        companyId: input.companyId ?? null,
        mode: trackingModeFor(input.searchType),
        searchType: input.searchType,
        searchKey: input.searchKey,
        creation: "confirmed",
        creationError: null,
        status: "created",
        recurrenceDays: input.recurrenceDays,
        hourRange: null,
        delivery: "webhook",
        createdAt: now,
        updatedAt: now,
        lastCheckedAt: null,
      };
      dispatch({
        type: "addTracking",
        tracking,
        activity: trackingActivity(
          tracking,
          getCompany(tracking.companyId),
          "Monitoramento criado (demonstração)",
        ),
      });
      return { ok: true, tracking };
    },
    [dataSource, state.trackings, getCompany],
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

  const markAlertRead = useCallback(
    (id: string) => dispatch({ type: "markAlertRead", id }),
    [],
  );
  const markAllAlertsRead = useCallback(
    () => dispatch({ type: "markAllAlertsRead" }),
    [],
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
          : (lawsuits.find((l) => l.companyId === tracking?.companyId) ?? null);
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
          companyId: tracking?.companyId ?? null,
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
              companyId: null,
              href: "/webhooks",
            },
          });
          return;
        }

        const isNewLawsuit = scenario === "new_lawsuit";
        const alert: AlertView = {
          id: newId(),
          type: isNewLawsuit ? "new_lawsuit" : "lawsuit_movement",
          companyId: tracking.companyId,
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
            companyId: tracking.companyId,
            href: "/alertas",
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
  }, [dataSource, initialState]);

  const value = useMemo<DemoStore>(
    () => ({
      ...state,
      trackings,
      dataSource,
      companies,
      lawsuits,
      getCompany,
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
      dataSource,
      companies,
      lawsuits,
      getCompany,
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
