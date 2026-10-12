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
import {
  getTrackingDisplayState,
  type NewTrackingInput,
  type Tracking,
} from "@/features/trackings/types";
import type { WebhookEventView } from "@/features/webhooks/types";

import type { DemoState } from "./data";

// Estado em memória da demonstração. Nada aqui é persistido nem enviado à JUDIT;
// recarregar a página restaura os dados iniciais.

export type SimulationScenario =
  | "lawsuit_movement"
  | "new_lawsuit"
  | "unknown_reference"
  | "duplicate_delivery";

type Action =
  | { type: "reset"; state: DemoState }
  | { type: "addTracking"; tracking: Tracking; activity: ActivityItem }
  | { type: "setTrackingStatus"; id: string; status: string }
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

export type AddTrackingResult =
  { ok: true; tracking: Tracking } | { ok: false; error: string };

export type SimulationResult =
  | { ok: true; eventId: string; duplicate: boolean }
  | { ok: false; error: string };

type DemoStore = DemoState & {
  companies: Company[];
  lawsuits: Lawsuit[];
  getCompany: (id: string | null) => Company | null;
  addTracking: (input: NewTrackingInput) => AddTrackingResult;
  setTrackingPaused: (id: string, paused: boolean) => void;
  markAlertRead: (id: string) => void;
  markAllAlertsRead: () => void;
  simulateWebhookEvent: (scenario: SimulationScenario) => SimulationResult;
  reset: () => void;
};

const DemoStoreContext = createContext<DemoStore | null>(null);

const PROCESSING_DELAY_MS = 1500;

export function DemoStoreProvider({
  initialState,
  companies,
  lawsuits,
  children,
}: {
  initialState: DemoState;
  companies: Company[];
  lawsuits: Lawsuit[];
  children: React.ReactNode;
}) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const companiesById = useMemo(
    () => new Map(companies.map((c) => [c.id, c])),
    [companies],
  );
  const getCompany = useCallback(
    (id: string | null) => (id ? (companiesById.get(id) ?? null) : null),
    [companiesById],
  );

  const addTracking = useCallback(
    (input: NewTrackingInput): AddTrackingResult => {
      const duplicate = state.trackings.find(
        (t) =>
          t.searchType === input.searchType &&
          t.searchKey === input.searchKey &&
          getTrackingDisplayState(t.status) !== "completed",
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
        // Sem ID da JUDIT: nenhum monitoramento real foi criado.
        juditTrackingId: null,
        companyId: input.companyId ?? null,
        searchType: input.searchType,
        searchKey: input.searchKey,
        status: "created",
        recurrenceDays: input.recurrenceDays ?? null,
        createdAt: now,
        updatedAt: now,
      };
      const company = getCompany(tracking.companyId);
      const identifier =
        input.searchType === "cnpj"
          ? `CNPJ ${formatCnpj(input.searchKey)}`
          : `CNJ ${formatCnj(input.searchKey)}`;
      dispatch({
        type: "addTracking",
        tracking,
        activity: {
          id: newId(),
          kind: "tracking_created",
          title: "Monitoramento criado (demonstração)",
          description: company?.legalName
            ? `${identifier} · ${company.legalName}`
            : identifier,
          occurredAt: now,
          companyId: tracking.companyId,
          href: "/monitoramentos",
        },
      });
      return { ok: true, tracking };
    },
    [state.trackings, getCompany],
  );

  const setTrackingPaused = useCallback((id: string, paused: boolean) => {
    dispatch({
      type: "setTrackingStatus",
      id,
      status: paused ? "paused" : "updated",
    });
  }, []);

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
            getTrackingDisplayState(t.status) === "active",
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
        processedAt: null,
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
          lawsuitCnj: lawsuit?.cnj ?? null,
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
    [state, lawsuits],
  );

  const reset = useCallback(
    () => dispatch({ type: "reset", state: initialState }),
    [initialState],
  );

  const value = useMemo<DemoStore>(
    () => ({
      ...state,
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
