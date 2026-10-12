# Webhooks

Recebimento e processamento dos callbacks enviados pela JUDIT.

Ainda não implementado. Na etapa de integração:

- O Route Handler ficará em `src/app/api/webhooks/judit/route.ts` e deverá
  apenas persistir o evento em `webhook_events` e responder rapidamente.
- O `callback_id` (único por entrega) é usado para descartar reentregas; a
  coluna `webhook_events.callback_id` já possui restrição `UNIQUE`.
- O payload original é sempre gravado em `webhook_events.payload` (JSONB).
- A validação de origem deve seguir apenas os mecanismos documentados pela
  JUDIT em <https://docs.judit.io/webhook/callbacks>. Não presumir assinatura.
