// Webhook deliveries taken from documented examples, shortened. All data is
// fictitious. JUDIT POSTs one of these per response to the request's
// callback_url (https://docs.judit.io/webhook/callbacks).

// A token that looks like the real one (64 hex characters), for tests only.
export const fakeWebhookToken = "0".repeat(32) + "f".repeat(32);

const callbackUrl = `https://exemplo.trycloudflare.com/api/webhooks/judit?token=${fakeWebhookToken}`;

// End of a request's flow: application_info with code 600. JUDIT echoes the
// callback_url in payload.tags, token included.
// https://docs.judit.io/webhook/callbacks ("Exemplo do aviso de finalização")
export const requestCompletedDelivery = {
  user_id: "ab829a35-894b-4fbd-9168-2398fd69cecc",
  callback_id: "b2f7c86c-0bdc-4f26-a42f-7f4760dba80f",
  event_type: "response_created",
  reference_type: "request",
  reference_id: "ec545a1e-c0ac-47cf-a3df-3668f1bdde11",
  payload: {
    response_id: "057b671c-0cb5-4ed1-af61-fc54fa3391ee",
    request_id: "ec545a1e-c0ac-47cf-a3df-3668f1bdde11",
    origin: "api",
    response_type: "application_info",
    response_data: {
      code: 600,
      message: "REQUEST_COMPLETED",
      savedResponseId: "057b671c-0cb5-4ed1-af61-fc54fa3391ee",
    },
    request_created_at: "2026-10-12T19:49:05.725Z",
    tags: { callback_url: callbackUrl },
    search: {
      on_demand: true,
      search_type: "lawsuit_cnj",
      search_key: "9999999-99.9999.9.99.9999",
    },
  },
};

// A lawsuit found by a tracking. Note the top-level `_id` with a `$oid`
// key: it is in the documented example and must not break the insert.
// https://docs.judit.io/tracking/tracking-document ("Recebendo a resposta
// enviada por webhook para monitoramento")
export const trackingLawsuitDelivery = {
  _id: { $oid: "65f0efe046ad3bda5b27be2d" },
  callback_id: "be1406d9-d62d-402d-8e0e-8684044645de",
  event_type: "response_created",
  reference_type: "tracking",
  reference_id: "8744cfea-f9d4-4e83-801e-bc05003ebf6b",
  user_id: "ac98336e-c493-4609-a058-cf7114f7a2ed",
  webhook_id: "2f82201d-1439-436d-8c6a-2e6b3e36a54f",
  payload: {
    request_id: "7d50b66c-3e86-4d0b-95af-5ff7561d18ff",
    response_id: "12576767-d3ea-4ea2-8805-6f2a73ef3439",
    response_type: "lawsuit",
    response_data: {
      code: "3000133-12.2025.8.19.0001",
      justice: "8",
      tribunal: "19",
      tribunal_acronym: "TJRJ",
      instance: 1,
      parties: [
        {
          side: "Passive",
          name: "USUÁRIO EXEMPLO 2",
          main_document: "99999999999",
          person_type: "EXECUTADO",
        },
      ],
      amount: 13687.36,
    },
  },
};

// Tracking paused automatically by the consumption cap (code 700).
// https://docs.judit.io/webhook/callbacks ("Monitoramento pausado por teto
// de consumo ou saldo")
export const trackingPausedDelivery = {
  callback_id: "0b1c3f7e-5a52-4c43-9a61-6a1e0d6e8f21",
  event_type: "response_created",
  reference_type: "tracking",
  reference_id: "8744cfea-f9d4-4e83-801e-bc05003ebf6b",
  payload: {
    response_type: "application_info",
    response_data: { code: 700, message: "TRACKING_PAUSED_BY_MAX_CONSUMPTION" },
  },
};
