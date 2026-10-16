// Quantos registros cada lista lê do banco, dos mais recentes para os mais
// antigos. As telas paginam no navegador o que foi lido e avisam quando o
// limite foi atingido (LimitNotice), para que um registro antigo não suma
// sem aviso. Trackings e partes são lidos inteiros: são poucos e as telas
// precisam de todos para associar alertas e consultas.
export const LIST_LIMITS = {
  alerts: 200,
  webhookEvents: 200,
  juditRequests: 200,
  syncQueries: 200,
} as const;
