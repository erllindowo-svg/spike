// Formato dos dados como a aplicação os usa. No MongoDB, cada documento guarda
// o identificador em `_id`; as funções de persistência o convertem para `id`
// (ver toModel em collections.ts). Campos que a JUDIT pode não fornecer são
// `null`, nunca omitidos, para que a interface trate a ausência explicitamente.

export type TrackingSearchType = "cnpj" | "cnj";

export type WebhookProcessingStatus =
  "pending" | "processing" | "processed" | "failed" | "ignored";

export type Company = {
  id: string;
  // Somente os 14 caracteres, sem máscara (aceita o CNPJ alfanumérico).
  cnpj: string;
  legalName: string | null;
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
  companyId: string | null;
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
};

export type Alert = {
  id: string;
  companyId: string | null;
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
  "datalake_sync" | "historical_async" | "historical_on_demand";

// Modalidades assíncronas: geram um `request_id` que precisa ser guardado
// para buscar o resultado depois.
export type AsyncQueryMode = Extract<
  QueryMode,
  "historical_async" | "historical_on_demand"
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
  companyId: string;
  mode: AsyncQueryMode;
  delivery: ResultDelivery;
  searchType: "cnpj";
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
