// Bodies taken from documented examples, shortened. All data is fictitious.

// https://docs.judit.io/requests/requests ("Exemplo de Resposta (Status 201)")
export const createdRequestBody = {
  request_id: "84b4d8f5-50f8-4c14-818f-912c722a6908",
  search: {
    search_type: "lawsuit_cnj",
    search_key: "0009999-99.9999.8.26.9999",
    response_type: "lawsuit",
  },
  with_attachments: true,
  status: "pending",
  created_at: "2024-06-18T22:03:35.560Z",
};

// https://docs.judit.io/requests/requests ("Passo 2", 200 OK)
export const completedRequestBody = {
  request_id: "05ee9825-b2b4-480b-b29e-f071ca7d9c72",
  search: {
    search_type: "lawsuit_cnj",
    search_key: "9999999-99.9999.9.99.9999",
    response_type: "lawsuit",
    search_params: { filter: {}, pagination: {} },
  },
  origin: "api",
  origin_id: "46fac09a-b34f-4dfd-a24f-b358bf04dfd4",
  user_id: "82082593-c664-4d7b-b174-2f0dc4791daf",
  status: "completed",
  created_at: "2024-02-21T17:33:22.876Z",
  updated_at: "2024-02-21T17:33:26.316Z",
  tags: { dashboard_id: null },
};

// https://docs.judit.io/requests/requests ("Exemplo de resposta simples")
export const responsesBody = {
  request_status: "completed",
  page: 1,
  page_count: 1,
  all_pages_count: 1,
  all_count: 1,
  page_data: [
    {
      request_id: "03abbf28-822e-45a0-a22c-098fbe157aa4",
      response_id: "061c60b2-7fa9-4d20-87bb-1bedd31d5572",
      origin: "api",
      origin_id: "03abbf28-822e-45a0-a22c-098fbe157aa4",
      response_type: "lawsuit",
      response_data: {
        code: "9999999-99.9999.9.99.9999",
        justice: "8",
        tribunal: "26",
        instance: 1,
        phase: "Execução ou cumprimento",
        status: "Ativo",
        name: "Usuário 4 X Usuário 2",
      },
      user_id: "7f8065a3-4891-428d-9456-dedfc12ff850",
      created_at: "2025-08-13T18:40:54.982Z",
      request_created_at: "2025-08-13T18:40:54.037Z",
      tags: {
        debug: true,
        dashboard_id: null,
        cached_response: false,
        cached: false,
      },
    },
  ],
};

// Item shape from https://docs.judit.io/resource/errors
// ("Exemplo de application_error"), placed in a /responses page.
export const applicationErrorItem = {
  request_id: "87d9f7bf-0071-41ee-a721-e6e1b4082bc9",
  response_id: "b6c1a4f0-1234-5678-9abc-def012345678",
  response_type: "application_error",
  response_data: {
    code: "LAWSUIT_NOT_FOUND",
    message:
      "Lawsuit 0000000-00.0000.0.00.0000 not found in datalake or court.",
  },
};
