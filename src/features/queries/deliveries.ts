import { readDelivery } from "@/features/webhooks/delivery";

// Conferência de entregas perdidas (IK10), para consultas com entrega por
// webhook. Compara o que a JUDIT lista em GET /responses com as entregas
// gravadas para o mesmo request_id, sem chamada nova à JUDIT: a lista já foi
// lida para mostrar o resultado.
//
// Documentado (https://docs.judit.io/webhook/callbacks): a JUDIT repete em
// 5xx ou timeout e pode perder eventos se a URL ficar fora do ar "por muito
// tempo". Hipótese nossa, não documentada: cada resposta da lista chega numa
// entrega própria, e o aviso de fim (application_info 600) é uma entrega a
// mais, que não está na lista. O teste real da etapa 5 bate com isso (um
// processo + o aviso 600).

export type DeliveryCheck = {
  // Respostas que a JUDIT lista para a consulta.
  expected: number;
  // Entregas gravadas com resposta (processo, erro, mandado...).
  received: number;
  // Chegou o aviso de fim (600)?
  completionNotice: boolean;
};

export function checkDeliveries(
  expected: number,
  storedPayloads: unknown[],
): DeliveryCheck {
  let received = 0;
  let completionNotice = false;
  for (const payload of storedPayloads) {
    const delivery = readDelivery(payload);
    if (delivery.kind === "request_completed") completionNotice = true;
    else if (
      delivery.kind !== "other_info" &&
      delivery.kind !== "tracking_paused"
    ) {
      received += 1;
    }
  }
  return { expected, received, completionNotice };
}

export function missingDeliveries(check: DeliveryCheck): number {
  return Math.max(0, check.expected - check.received);
}
