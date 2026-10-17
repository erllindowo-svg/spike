import type {
  JuditRequest,
  QueryMode,
  QuerySearchType,
  ResultDelivery,
  SyncQuery,
  SyncQueryOutcome,
} from "@/lib/models";

// Uma linha da página Consultas. Junta as duas origens no mesmo formato:
// consultas síncronas (coleção sync_queries) e assíncronas (judit_requests).
export type QueryView = {
  id: string;
  flow: "sync" | "async";
  mode: QueryMode;
  partyId: string | null;
  // Documento (CNPJ, CPF) ou número do processo (CNJ), sem máscara.
  searchType: QuerySearchType;
  searchKey: string;
  createdAt: Date;
  // request_id da JUDIT: sempre na assíncrona; na síncrona, quando veio.
  requestId: string | null;
  // Assíncrona: status bruto da JUDIT (pending, completed...).
  asyncStatus: string | null;
  // Síncrona: resultado do nosso lado (models.ts).
  syncOutcome: SyncQueryOutcome | null;
  // Síncrona: quantos itens vieram.
  resultCount: number | null;
  // Assíncrona: como o resultado chega (polling ou webhook).
  delivery: ResultDelivery | null;
  lastCheckedAt: Date | null;
};

export function fromJuditRequest(request: JuditRequest): QueryView {
  return {
    id: request.id,
    flow: "async",
    mode: request.mode,
    partyId: request.partyId,
    searchType: request.searchType,
    searchKey: request.searchKey,
    createdAt: request.createdAt,
    requestId: request.requestId,
    asyncStatus: request.status,
    syncOutcome: null,
    resultCount: null,
    delivery: request.delivery,
    lastCheckedAt: request.lastCheckedAt,
  };
}

export function fromSyncQuery(query: SyncQuery): QueryView {
  return {
    id: query.id,
    flow: "sync",
    mode: query.mode,
    partyId: query.partyId,
    searchType: query.searchType,
    searchKey: query.searchKey,
    createdAt: query.createdAt,
    requestId: query.requestId,
    asyncStatus: null,
    syncOutcome: query.outcome,
    resultCount: query.resultCount,
    delivery: null,
    lastCheckedAt: null,
  };
}

// Uma lista só, da mais nova para a mais antiga.
export function mergeQueries(...lists: QueryView[][]): QueryView[] {
  return lists
    .flat()
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

// Consulta ainda sem resultado final: assíncrona antes de "completed" (ou
// de um status final desconhecido, que aparece como veio).
export function isQueryOpen(query: QueryView): boolean {
  return (
    query.flow === "async" &&
    (query.asyncStatus === "pending" || query.asyncStatus === "started")
  );
}
