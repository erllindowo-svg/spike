// Bodies copied from documented examples. All data is fictitious.

// https://docs.judit.io/introduction/authentication ("Erro 401")
export const unauthorizedBody = {
  error: {
    name: "HttpUnauthorizedError",
    message: "UNAUTHORIZED",
    data: "USER_NOT_FOUND",
  },
};

// https://docs.judit.io/resource/errors: the page gives the nested shape and
// the `REQUEST_NOT_FOUND` name for 404, but no full 404 example. This one
// combines both.
export const notFoundBody = {
  error: {
    name: "REQUEST_NOT_FOUND",
    message: "NOT_FOUND",
    data: "Request not found",
  },
};

// https://docs.judit.io/essentialConcepts/rate-limits ("Como Tratar o Erro 429")
export const tooManyRequestsBody = {
  error: "Too Many Requests",
  message: "Rate limit exceeded. Try again in a few seconds.",
  code: 429,
};

// https://docs.judit.io/resource/errors ("Exemplo de application_error")
export const applicationErrorBody = {
  request_id: "87d9f7bf-0071-41ee-a721-e6e1b4082bc9",
  responses: [
    {
      response_id: "b6c1a4f0-1234-5678-9abc-def012345678",
      response_type: "application_error",
      response_data: {
        code: "LAWSUIT_NOT_FOUND",
        message:
          "Lawsuit 0000000-00.0000.0.00.0000 not found in datalake or court.",
      },
    },
  ],
};
