import type { QueryMode, TrackingMode, TrackingSearchType } from "@/lib/models";

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
  // "recurring": roda na JUDIT a cada N dias, até ser pausado ou excluído.
  flow: "sync" | "async" | "recurring";
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
  datalake_count: {
    label: "Contagem de processos",
    endpoint: "POST /lawsuits/count",
    flow: "sync",
    sources: "Base de dados da JUDIT.",
    purpose:
      "Só o total de processos, sem a lista. Responde rápido se há processos e mostra o tamanho antes de pedir a lista.",
    cost: "Cobrada por requisição.",
    docsUrl: "https://docs.judit.io/cache-judit/count",
  },
  datalake_synthetic: {
    label: "Resumo agrupado",
    endpoint: "POST /lawsuits/synthetic",
    flow: "sync",
    sources: "Base de dados da JUDIT.",
    purpose:
      "Quantos processos por tribunal, área, fase e lado da parte, sem a lista. Visão geral para avaliar risco.",
    cost: "Cobrada por requisição.",
    docsUrl: "https://docs.judit.io/cache-judit/cache-grouped",
  },
  registration_data: {
    label: "Consulta de dados cadastrais",
    endpoint: "POST /entities",
    flow: "sync",
    sources: "Base de dados da JUDIT (cadastro da Receita Federal).",
    purpose:
      "Nome e situação cadastral na Receita Federal (de uma empresa ou de uma pessoa), na resposta da própria chamada.",
    cost: "Cobrada por requisição.",
    docsUrl: "https://docs.judit.io/registration-data/registration-data",
  },
  lawsuit_datalake: {
    label: "Processo na base da JUDIT",
    endpoint: "GET /lawsuits/{cnj}",
    flow: "sync",
    sources: "Base de dados da JUDIT (pode estar defasada).",
    purpose: "A capa de um processo pelo número CNJ, como está guardada.",
    cost: "Não informado pela documentação.",
    docsUrl: "https://docs.judit.io/cache-judit/on-demand",
  },
  lawsuit_on_demand: {
    label: "Processo atualizado no tribunal",
    endpoint: "POST /lawsuits com on_demand",
    flow: "sync",
    sources: "Tribunal em tempo real, quando a base está defasada.",
    purpose:
      "O processo pelo número CNJ, com garantia de atualização. Pode levar até 3 minutos.",
    cost: "Cobrada por requisição.",
    docsUrl: "https://docs.judit.io/cache-judit/on-demand",
  },
  registration_on_demand: {
    label: "Dados cadastrais na Receita",
    endpoint: "POST /entities com on_demand",
    flow: "sync",
    sources: "Receita Federal em tempo real.",
    purpose:
      "Nome e situação cadastral lidos na hora na Receita, em vez da base da JUDIT. Para decisões em que o dado precisa estar atual.",
    cost: "Mais cara que a consulta de dados cadastrais comum.",
    docsUrl: "https://docs.judit.io/registration-data/registration-data",
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
  lawsuit_async: {
    label: "Consulta processual completa",
    endpoint: "POST /requests (search_type lawsuit_cnj)",
    flow: "async",
    sources: "Tribunal do processo, com a fotografia mais recente.",
    purpose:
      "O processo inteiro pelo número CNJ: capa, partes e andamentos. Pode vir com um resumo escrito por IA (beta).",
    cost: "Cobrada por requisição; o resumo por IA tem custo não informado.",
    docsUrl: "https://docs.judit.io/requests/requests",
  },
  warrant: {
    label: "Mandados de prisão",
    endpoint: "POST /requests (response_type warrant)",
    flow: "async",
    sources: "Banco Nacional de Mandados de Prisão (BNMP).",
    purpose:
      "Mandados de prisão e de recaptura ligados a uma pessoa (por CPF, nome ou RJI), com a situação de cada um.",
    cost: "Cobrada por requisição.",
    docsUrl: "https://docs.judit.io/criminal-consultation/warrant",
  },
  criminal_execution: {
    label: "Execução penal",
    endpoint: "POST /requests (response_type execution)",
    flow: "async",
    sources: "Processos de execução penal nos tribunais.",
    purpose:
      "Processos de cumprimento de pena ligados a uma pessoa, empresa ou processo, com andamentos.",
    cost: "Cobrada por requisição.",
    docsUrl: "https://docs.judit.io/criminal-consultation/criminal-execution",
  },
} as const satisfies Record<QueryMode, QueryModeInfo>;

export const TRACKING_MODES = {
  tracking_document: {
    label: "Monitoramento por documento",
    endpoint: "POST /tracking (search_type cpf, cnpj ou oab)",
    flow: "recurring",
    sources: "Tribunais, consultados pela JUDIT a cada N dias (on-demand).",
    purpose:
      "Detecta o nascimento de novos processos ligados ao documento (CPF, CNPJ ou OAB), que não existiam quando o monitoramento começou.",
    cost: "Recorrente enquanto ativo. A documentação pede para verificar as condições de custo; valores não publicados.",
    docsUrl: "https://docs.judit.io/tracking/tracking-document",
  },
  tracking_lawsuit: {
    label: "Monitoramento processual",
    endpoint: "POST /tracking (search_type lawsuit_cnj)",
    flow: "recurring",
    sources: "Tribunal do processo, consultado pela JUDIT a cada N dias.",
    purpose:
      "Acompanha as movimentações de um processo já conhecido, pelo número CNJ.",
    cost: "Recorrente enquanto ativo; a documentação não informa o preço.",
    docsUrl: "https://docs.judit.io/tracking/tracking",
  },
} as const satisfies Record<TrackingMode, QueryModeInfo>;

// Hoje cada tipo de identificador tem uma só modalidade de monitoramento.
export function trackingModeFor(searchType: TrackingSearchType): TrackingMode {
  return searchType === "cnj" ? "tracking_lawsuit" : "tracking_document";
}
