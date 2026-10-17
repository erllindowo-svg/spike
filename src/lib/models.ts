// Formato dos dados como a aplicação os usa. São os mesmos tipos do app real
// (no main, src/db/models.ts, gravados no MongoDB); no protótipo, os dados
// fictícios de mock-data.ts seguem este formato. Campos que a JUDIT pode não
// fornecer são `null`, nunca omitidos, para que a interface trate a ausência
// explicitamente.

// Documentos que identificam uma parte (empresa ou pessoa física). OAB e
// nome ficam para depois (escolha R1 em docs/etapa-7-escopo.md).
export type DocumentType = "cnpj" | "cpf";

// Todos os identificadores que a página Consultar reconhece pela digitação
// (src/features/consult/identify.ts): os da JUDIT (`search_type`: cpf, cnpj,
// oab, name, rji, lawsuit_cnj), com "cnj" no lugar de "lawsuit_cnj".
export type SearchType = DocumentType | "cnj" | "oab" | "name" | "rji";

// OAB entrou no círculo 3: a JUDIT monitora cpf, cnpj e oab por documento
// (https://docs.judit.io/tracking/tracking-document).
export type TrackingSearchType = DocumentType | "cnj" | "oab";

export type WebhookProcessingStatus =
  "pending" | "processing" | "processed" | "failed" | "ignored";

// Parte: uma empresa (CNPJ) ou uma pessoa física (CPF) que o app acompanha.
// Uma coleção só para as duas (escolha R2): monitoramentos, consultas e
// alertas apontam para a parte, seja qual for o documento.
export type Party = {
  id: string;
  documentType: DocumentType;
  // Sem máscara: 14 caracteres no CNPJ (aceita o alfanumérico), 11 dígitos
  // no CPF.
  document: string;
  // Razão social (empresa) ou nome (pessoa), dos dados cadastrais.
  name: string | null;
  // Nome fantasia (`social_name`), só de empresas. Opcional: partes gravadas
  // antes do círculo 2 não têm o campo.
  tradeName?: string | null;
  registrationStatus: string | null;
  createdAt: Date;
  updatedAt: Date;
};

// Modalidades de monitoramento da JUDIT (catálogo em
// src/features/queries/modes.ts). O `searchType` sozinho não basta: o
// monitoramento customizado e o do Diário Oficial também usam CNPJ.
export type TrackingMode = "tracking_document" | "tracking_lawsuit";

// Ciclo de criação do monitoramento, do nosso lado. Fica separado de
// `status`, que é o valor bruto da JUDIT:
//
//   pending    reservado no banco, ainda não enviado (pode ser enviado ou
//              descartado)
//   sending    envio em andamento; se ficar parado aqui, o resultado é incerto
//   confirmed  a JUDIT criou e devolveu o tracking_id
//   failed     a JUDIT recusou; nada foi criado e o identificador fica livre
//   uncertain  sem resposta clara (timeout, rede, erro 5xx): pode existir na
//              JUDIT, por isso o identificador continua bloqueado
export type TrackingCreation =
  "pending" | "sending" | "confirmed" | "failed" | "uncertain";

export type Tracking = {
  id: string;
  // Nulo enquanto o monitoramento ainda não foi confirmado pela JUDIT.
  juditTrackingId: string | null;
  partyId: string | null;
  mode: TrackingMode;
  searchType: TrackingSearchType;
  searchKey: string;
  creation: TrackingCreation;
  // Motivo resumido de `failed` ou `uncertain`, para diagnóstico.
  creationError: string | null;
  // Valor bruto informado pela JUDIT; texto livre para não quebrar caso a API
  // passe a retornar novos estados.
  status: string | null;
  // Intervalo em dias entre execuções, conforme definido na JUDIT.
  recurrenceDays: number | null;
  // Hora do dia (0-23) da primeira execução, informada na criação.
  hourRange: number | null;
  // Como os resultados chegam até nós (webhook só na etapa 5).
  delivery: ResultDelivery;
  // Só no monitoramento por CNJ: a JUDIT avisa apenas as movimentações com
  // um destes termos (`notification_filters.step_terms`). Nulo: todas.
  stepTerms: string[] | null;
  createdAt: Date;
  updatedAt: Date;
  // Última vez que perguntamos o status à JUDIT. Nulo até a primeira.
  lastCheckedAt: Date | null;
};

export type WebhookEvent = {
  id: string;
  // Identificador único da entrega; o índice único impede reprocessar
  // reentregas. Nulos são permitidos e não colidem entre si.
  callbackId: string | null;
  eventType: string | null;
  referenceType: string | null;
  referenceId: string | null;
  payload: unknown;
  receivedAt: Date;
  processingStatus: WebhookProcessingStatus;
  // Início da última tentativa de processamento. Serve para perceber um
  // evento preso em "processing" (o servidor caiu no meio).
  processingStartedAt: Date | null;
  // Fim do processamento (processed, ignored ou failed).
  processedAt: Date | null;
  // O que o processamento fez, ou por que ignorou o evento. Texto para o
  // diagnóstico, sem dados do processo.
  processingNote: string | null;
  // Motivo de "failed".
  processingError: string | null;
  // Reentregas com o mesmo callback_id, recusadas pelo índice único. Muitas
  // indicam que a JUDIT não recebeu o nosso 2xx a tempo.
  duplicateDeliveries: number;
};

export type Alert = {
  id: string;
  partyId: string | null;
  // Evento que gerou o alerta. Num alerta deduplicado, é a primeira entrega.
  webhookEventId: string | null;
  // Monitoramento do app (o `id` local, não o tracking_id da JUDIT).
  trackingId: string | null;
  // Só os 20 dígitos, como em Lawsuit.cnj.
  lawsuitCnj: string | null;
  // Regra de unicidade do alerta, com índice único: o mesmo fato não gera
  // dois alertas, mesmo que o evento chegue de novo ou seja reprocessado.
  // Montada em src/features/webhooks/process.ts (alertKey).
  dedupeKey: string;
  title: string;
  description: string | null;
  type: string;
  createdAt: Date;
  // Nulo indica alerta não lido.
  readAt: Date | null;
};

// Modalidades de consulta à JUDIT. Cada consulta declara a sua de forma
// explícita, em vez de deduzi-la de parâmetros como `on_demand`. O catálogo
// com endpoint, fluxo, fontes e custo de cada uma fica em
// src/features/queries/modes.ts.
export type QueryMode =
  | "datalake_sync"
  | "datalake_count"
  | "datalake_synthetic"
  | "registration_data"
  | "registration_on_demand"
  | "lawsuit_datalake"
  | "lawsuit_on_demand"
  | "historical_async"
  | "historical_on_demand"
  | "lawsuit_async"
  | "warrant"
  | "criminal_execution";

// Modalidades síncronas: a resposta vem na própria chamada.
export type SyncQueryMode = Extract<
  QueryMode,
  | "datalake_sync"
  | "datalake_count"
  | "datalake_synthetic"
  | "registration_data"
  | "registration_on_demand"
  | "lawsuit_datalake"
  | "lawsuit_on_demand"
>;

// O que se procura numa consulta: um documento (parte), um processo (CNJ),
// uma OAB, um nome ou um RJI (círculo 3). Registros antigos só têm os três
// primeiros.
export type QuerySearchType = SearchType;

// Modalidades assíncronas: geram um `request_id` que precisa ser guardado
// para buscar o resultado depois.
export type AsyncQueryMode = Extract<
  QueryMode,
  | "historical_async"
  | "historical_on_demand"
  | "lawsuit_async"
  | "warrant"
  | "criminal_execution"
>;

// Como o resultado de uma consulta assíncrona chega até nós: perguntando
// (polling) ou sendo avisados pela JUDIT (webhook, etapa 5).
export type ResultDelivery = "polling" | "webhook";

// Ponteiro para uma consulta assíncrona criada na JUDIT (POST /requests).
// Os processos encontrados NÃO são gravados aqui: continuam sendo lidos da
// JUDIT. Guardamos só o necessário para acompanhar a consulta e conferir o
// consumo.
export type JuditRequest = {
  id: string;
  // `request_id` devolvido pela JUDIT; único no banco.
  requestId: string;
  // Nulo numa consulta por processo (CNJ): não há parte.
  partyId: string | null;
  mode: AsyncQueryMode;
  delivery: ResultDelivery;
  searchType: QuerySearchType;
  searchKey: string;
  // Enviado só na modalidade on-demand; nulo quando não enviado.
  cacheTtlInDays: number | null;
  // Valor bruto informado pela JUDIT (pending, started, completed...).
  status: string;
  createdAt: Date;
  updatedAt: Date;
  // Última vez que perguntamos o status à JUDIT. Nulo até a primeira.
  lastCheckedAt: Date | null;
};

// Resultado de uma consulta síncrona, do nosso lado:
//   ok         a JUDIT respondeu (com ou sem itens)
//   failed     a JUDIT respondeu com erro
//   uncertain  sem resposta a tempo: pode ter sido processada (e cobrada)
export type SyncQueryOutcome = "ok" | "failed" | "uncertain";

// Registro de uma consulta síncrona que chegou à JUDIT (coleção
// `sync_queries`). Só metadados, para o histórico da página Consultas e para
// o suporte: os dados devolvidos (processos, dados cadastrais) não ficam
// aqui. Chamadas barradas antes de sair do servidor (kill switch, allowlist)
// não são registradas, porque não chegaram à JUDIT.
export type SyncQuery = {
  id: string;
  mode: SyncQueryMode;
  // Nulo quando a consulta foi feita antes de a empresa ser salva (o
  // diálogo "Adicionar empresa" consulta primeiro e salva depois).
  partyId: string | null;
  searchType: QuerySearchType;
  searchKey: string;
  // `request_id` devolvido pela JUDIT, quando ela devolve; útil para levar
  // ao suporte da JUDIT.
  requestId: string | null;
  outcome: SyncQueryOutcome;
  // Quantos itens vieram (processos ou cadastros); nulo sem resposta.
  resultCount: number | null;
  // Tipo do erro (a `kind` das classes de src/lib/judit/errors.ts), sem
  // mensagem nem dados.
  errorKind: string | null;
  createdAt: Date;
};

// --- Base própria (círculo 3, fatia 5; decisão D1) -------------------------
//
// O que a JUDIT devolve passa a ser gravado no nosso formato, uma coleção por
// coisa: processos (e execuções penais, que têm o formato de processo),
// cadastros, mandados e contagens. Cada registro guarda os campos que o app
// usa, já normalizados, e o item inteiro como a JUDIT mandou (`juditData`),
// para nada se perder. Regra de atualização: o dado mais novo substitui o
// anterior (`fetchedAt`), guardando a origem. A ligação "encontrado ao
// pesquisar tal identificador" fica em `findings`.

// De onde veio um registro da base própria.
export type RecordOrigin = "sync" | "async" | "webhook" | "tracking";

export type RecordSource = {
  origin: RecordOrigin;
  mode: QueryMode | TrackingMode;
  // request_id (consulta) ou tracking_id (monitoramento) da JUDIT, quando
  // houver; leva ao suporte da JUDIT.
  reference: string | null;
};

type StoredRecord = {
  id: string;
  // Item como a JUDIT mandou (um processo, um cadastro, um mandado), sem o
  // envelope da resposta.
  juditData: unknown;
  source: RecordSource;
  // Quando a JUDIT produziu ou nos entregou este conteúdo. Decide a
  // atualização: um conteúdo mais velho não substitui um mais novo.
  fetchedAt: Date;
  firstSeenAt: Date;
};

export type StoredLawsuit = StoredRecord & {
  // 20 dígitos. A chave é o CNJ com a instância: o mesmo número existe em
  // primeira e segunda instância.
  cnj: string;
  instance: number;
  kind: "lawsuit" | "execution";
  tribunal: string | null;
  area: string | null;
  className: string | null;
  subject: string | null;
  judgingBody: string | null;
  status: "active" | "archived" | "suspended" | null;
  distributedAt: Date | null;
  lastMovementAt: Date | null;
  amount: number | null;
  // `secrecy_level` da JUDIT; > 0 é segredo de justiça (a JUDIT já devolve
  // quase tudo vazio). Gravado como veio, para a tela avisar.
  secrecyLevel: number | null;
  // Resumo escrito pela IA da JUDIT, quando pedido (consulta processual
  // completa). Só é trocado por outro resumo, nunca apagado por uma
  // resposta sem resumo.
  aiSummary: string | null;
};

export type StoredRegistration = StoredRecord & {
  documentType: DocumentType;
  document: string;
  name: string | null;
  tradeName: string | null;
  registrationStatus: string | null;
  specialStatus: string | null;
};

// Contagem e resumo agrupado: números sobre um identificador, não itens.
export type LawsuitStats = StoredRecord & {
  searchType: SearchType;
  searchKey: string;
  mode: "datalake_count" | "datalake_synthetic";
  total: number | null;
  groups: { title: string; data: { label: string; value: number }[] }[];
};

// --- Busca (círculo 3B, opção B) --------------------------------------------
//
// Uma entrada por coisa que se pode achar na barra de pesquisa e no Acervo:
// cada assunto (CPF, CNPJ, OAB, nome, RJI) e cada processo guardado (como
// assunto "cnj"). É um dado DERIVADO das outras coleções: pode ser apagado e
// reconstruído (src/features/search/entries.ts). Também dá o nome e o resumo
// curto que a página Consultar mostra para um identificador conhecido.
export type SearchEntry = {
  id: string;
  searchType: SearchType;
  searchKey: string;
  // Nome da parte, do cadastro ou o próprio nome pesquisado.
  name: string | null;
  // Uma linha de contexto: situação cadastral, ou tribunal e área do
  // processo.
  detail: string | null;
  // Processos guardados que este assunto encontrou.
  lawsuits: number;
  // Palavras pesquisáveis, em minúsculas e sem acento (terms.ts).
  terms: string[];
  // Versão das regras que montaram `terms` (TERMS_VERSION, em terms.ts).
  // Só no banco: a demonstração monta tudo na hora.
  termsVersion?: number;
  // A atividade mais recente: consulta, dado recebido ou monitoramento.
  lastSeenAt: Date;
};
