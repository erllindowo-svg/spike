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
