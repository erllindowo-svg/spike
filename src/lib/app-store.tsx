"use client";

import { createContext, useCallback, useContext, useMemo } from "react";

import {
  markAlertReadAction,
  markAllAlertsReadAction,
} from "@/features/alerts/actions";
import type { Party } from "@/features/parties/types";
import type { QueryView } from "@/features/queries/types";
import type { NewTrackingInput, Tracking } from "@/features/trackings/types";
import {
  createTrackingAction,
  type CreateTrackingActionResult,
} from "@/features/trackings/actions";

import type { AppState } from "./data";

// O que as telas do navegador compartilham: as listas lidas do MongoDB pelo
// layout (src/app/(app)/layout.tsx) e as funções que mudam esses dados pelas
// server actions. Não há cópia no navegador: cada action que muda dados
// chama refresh(), o layout é desenhado de novo no servidor, relê o banco e
// entrega as listas novas por aqui.

// A server action não respondeu (servidor reiniciando, rede). A operação pode
// ter sido concluída no servidor mesmo assim.
export const SERVER_UNREACHABLE =
  "Sem resposta do servidor da aplicação. A operação pode ter sido concluída: recarregue a página e confira antes de repetir.";

const trackingErrorMessages = {
  duplicate: "Já existe um monitoramento ativo para este identificador.",
  invalid_input: "Os dados do monitoramento são inválidos.",
  error: "Não foi possível salvar no banco. Tente novamente em instantes.",
} as const;

// `notice` resume o que aconteceu com o envio à JUDIT.
export type AddTrackingResult =
  | {
      ok: true;
      tracking: Tracking;
      notice: { sent: boolean; message: string };
    }
  | { ok: false; error: string };

type AppStore = AppState & {
  parties: Party[];
  // Histórico de consultas (síncronas e assíncronas), lido do servidor a
  // cada navegação. A barra de pesquisa monta os assuntos com ele.
  queries: QueryView[];
  getParty: (id: string | null) => Party | null;
  addTracking: (input: NewTrackingInput) => Promise<AddTrackingResult>;
  // Uma falha só deixa o alerta como não lido.
  markAlertRead: (id: string) => void;
  // Resolve com a mensagem de erro, ou null se deu certo.
  // Sem argumento, todos; com o id de um monitoramento, só os dele.
  markAllAlertsRead: (trackingId?: string) => Promise<string | null>;
};

const AppStoreContext = createContext<AppStore | null>(null);

export function AppStoreProvider({
  initialState,
  parties,
  queries,
  children,
}: {
  initialState: AppState;
  parties: Party[];
  queries: QueryView[];
  children: React.ReactNode;
}) {
  const partiesById = useMemo(
    () => new Map(parties.map((p) => [p.id, p])),
    [parties],
  );
  const getParty = useCallback(
    (id: string | null) => (id ? (partiesById.get(id) ?? null) : null),
    [partiesById],
  );

  // A regra de duplicidade e a validação ficam no servidor (banco). O
  // monitoramento novo chega à lista pelo refresh() da action.
  const addTracking = useCallback(
    async (input: NewTrackingInput): Promise<AddTrackingResult> => {
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
      return {
        ok: true,
        tracking: result.tracking,
        notice: {
          sent: result.outcome === "confirmed",
          message: result.message,
        },
      };
    },
    [],
  );

  // A leitura é gravada no banco; o alerta aparece como lido quando o
  // refresh() da action entrega a lista nova.
  const markAlertRead = useCallback((id: string) => {
    markAlertReadAction(id).catch(() => {});
  }, []);
  const markAllAlertsRead = useCallback(
    async (trackingId?: string): Promise<string | null> => {
      try {
        const result = await markAllAlertsReadAction(trackingId);
        return result.ok ? null : result.message;
      } catch {
        return SERVER_UNREACHABLE;
      }
    },
    [],
  );

  const value = useMemo<AppStore>(
    () => ({
      ...initialState,
      parties,
      queries,
      getParty,
      addTracking,
      markAlertRead,
      markAllAlertsRead,
    }),
    [
      initialState,
      parties,
      queries,
      getParty,
      addTracking,
      markAlertRead,
      markAllAlertsRead,
    ],
  );

  return (
    <AppStoreContext.Provider value={value}>
      {children}
    </AppStoreContext.Provider>
  );
}

export function useAppStore(): AppStore {
  const store = useContext(AppStoreContext);
  if (!store) {
    throw new Error("useAppStore deve ser usado dentro de AppStoreProvider.");
  }
  return store;
}
