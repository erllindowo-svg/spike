import type { AsyncQueryMode, QueryMode } from "@/db/models";

// Catálogo das modalidades de consulta à JUDIT usadas pela aplicação. Cada
// consulta declara a sua modalidade pelo identificador (`QueryMode`), que é
// gravado no banco e não muda. Os rótulos são provisórios: podem mudar na
// interface sem afetar os dados gravados.
//
// O texto visível segue o vocabulário da documentação da JUDIT ("consulta
// síncrona", "consulta assíncrona", "on-demand").

export type QueryModeInfo = {
  label: string;
  endpoint: string;
  flow: "sync" | "async";
  // De onde a JUDIT tira os dados, segundo a documentação.
  sources: string;
  purpose: string;
  cost: string;
  docsUrl: string;
};

export const QUERY_MODES = {
  datalake_sync: {
    label: "Consulta síncrona",
    endpoint: "POST /lawsuits",
    flow: "sync",
    sources: "Base de dados da JUDIT.",
    purpose:
      "Lista imediata dos processos, na resposta da própria chamada. Indicada para fluxos que precisam de resposta rápida.",
    cost: "Cobrada por requisição.",
    docsUrl: "https://docs.judit.io/cache-judit/hotstorage",
  },
  historical_async: {
    label: "Consulta assíncrona",
    endpoint: "POST /requests",
    flow: "async",
    sources: "Base de dados da JUDIT e fontes externas indexadas.",
    purpose:
      "Histórico processual mais completo. O resultado não vem na hora: a consulta é criada, depois se verifica o status e se leem as respostas.",
    cost: "Cobrada por requisição.",
    docsUrl: "https://docs.judit.io/requests/request-document",
  },
  historical_on_demand: {
    label: "Consulta assíncrona on-demand",
    endpoint: "POST /requests com on_demand",
    flow: "async",
    sources:
      "Base de dados da JUDIT, fontes externas e tribunais em tempo real.",
    purpose:
      "Máxima completude: vai aos tribunais. Com cache_ttl_in_days, aceita um resultado guardado se a última extração tiver até N dias.",
    cost: "Custo maior que a consulta assíncrona comum; valores não publicados.",
    docsUrl: "https://docs.judit.io/requests/request-document",
  },
} as const satisfies Record<QueryMode, QueryModeInfo>;

export const ASYNC_QUERY_MODES = [
  "historical_async",
  "historical_on_demand",
] as const satisfies readonly AsyncQueryMode[];
