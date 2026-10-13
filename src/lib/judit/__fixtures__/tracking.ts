// Bodies taken from documented examples, shortened. All data is fictitious.

// https://docs.judit.io/tracking/tracking (create, "Ver exemplo de resposta")
export const createdCnjTrackingBody = {
  tracking_id: "d923253e-45c1-46e5-ac70-164839d9851c",
  user_id: "7f8065a3-4891-428d-9456-dedfc12ff850",
  status: "created",
  recurrence: 1,
  notification_emails: [],
  notification_filters: { step_terms: [], _id: "67ffb7a1062277871357743f" },
  with_attachments: false,
  plan_config_type: "simple_lawsuit_tracking",
  fixed_time: false,
  hour_range: 21,
  search: {
    search_type: "lawsuit_cnj",
    search_key: "1111111-04.1111.1.11.1111",
    response_type: "lawsuit",
    search_params: { filter: {}, pagination: {} },
  },
  tags: {},
  created_at: "2025-04-16T13:58:56.352Z",
  updated_at: "2025-04-16T13:58:56.352Z",
};

// https://docs.judit.io/tracking/tracking-document (create by CNPJ)
export const createdCnpjTrackingBody = {
  tracking_id: "15d632c6-a2ab-40c1-bfc5-d8f7bf8d8dd9",
  user_id: "82082593-c664-4d7b-b174-2f0dc4791daf",
  status: "created",
  recurrence: 1,
  search: {
    search_type: "cnpj",
    search_key: "00.000.000/0001-00",
    response_type: "lawsuit",
    search_params: { filter: {}, pagination: {} },
  },
  hour_range: 21,
  tracked_items_count: 0,
  tracked_items_steps_count: 0,
  tags: {},
  created_at: "2024-02-21T18:26:38.499Z",
  updated_at: "2024-02-21T18:26:38.499Z",
};

// https://docs.judit.io/tracking/tracking ("Pausando um Monitoramento")
export const pausedTrackingBody = {
  tracking_id: "15d632c6-a2ab-40c1-bfc5-d8f7bf8d8dd9",
  user_id: "82082593-c664-4d7b-b174-2f0dc4791daf",
  status: "paused",
  recurrence: 1,
  search: {
    search_type: "lawsuit_cnj",
    search_key: "9999999-99.9999.9.99.9999",
    response_type: "lawsuit",
    search_params: { filter: {}, pagination: {} },
  },
  tracked_items_count: 0,
  tracked_items_steps_count: 0,
  tags: {},
  created_at: "2024-02-21T18:26:38.499Z",
  updated_at: "2024-02-21T18:26:38.499Z",
};
