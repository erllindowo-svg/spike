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

export type Tracking = {
  id: string;
  // Nulo enquanto o monitoramento ainda não foi confirmado pela JUDIT.
  juditTrackingId: string | null;
  companyId: string | null;
  searchType: TrackingSearchType;
  searchKey: string;
  // Valor bruto informado pela JUDIT; texto livre para não quebrar caso a API
  // passe a retornar novos estados.
  status: string | null;
  // Intervalo em dias entre execuções, conforme definido na JUDIT.
  recurrenceDays: number | null;
  createdAt: Date;
  updatedAt: Date;
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
  processedAt: Date | null;
  processingError: string | null;
};

export type Alert = {
  id: string;
  companyId: string | null;
  webhookEventId: string | null;
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
