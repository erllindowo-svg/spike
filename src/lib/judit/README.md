# Integração JUDIT

Cliente HTTP e funções de chamada aos serviços da JUDIT (somente servidor).

Regras:

- Todo módulo desta pasta deve começar com `import "server-only"`.
- A chave é lida via `getServerEnv("JUDIT_API_KEY")` (`src/lib/env.ts`) e
  nunca deve ser registrada em logs, retornada ao cliente ou exposta em
  variáveis `NEXT_PUBLIC_*`.

## Arquivos

| Arquivo               | Responsabilidade                                                                                                                                    |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `client.ts`           | `juditRequest`: URL base, header `api-key`, timeout, mapeamento de erros, validação                                                                 |
| `errors.ts`           | Classes de erro tipadas (rede, timeout, HTTP, 429, application_error, resposta)                                                                     |
| `guard.ts`            | Kill switch (`JUDIT_LIVE_CALLS`) e allowlist de chaves de busca                                                                                     |
| `schemas/common.ts`   | Schemas Zod tolerantes para corpos de erro                                                                                                          |
| `lawsuits.ts`         | Serviço lawsuits: `getEntity`, `searchLawsuits`, `countLawsuits`, `getLawsuitsSynthetic`, `getLawsuitByCnj`                                         |
| `schemas/lawsuits.ts` | Schemas das respostas de lawsuits e do filtro de busca                                                                                              |
| `dev-route.ts`        | Regras das rotas de teste manual (404 fora de dev, mapeamento de erros para HTTP)                                                                   |
| `requests.ts`         | Serviço requests: `createRequest`, `getRequest`, `listRequests`, `listResponses`, `getResponse`, `listTrackingResponses`                            |
| `schemas/requests.ts` | Schemas de request, resposta e paginação; `responseCameFromCache`                                                                                   |
| `tracking.ts`         | Serviço tracking: `createTracking`, `listTrackings`, `getTracking`, `updateTrackingRecurrence`, `pauseTracking`, `resumeTracking`, `deleteTracking` |
| `schemas/tracking.ts` | Schemas de tracking e da lista paginada                                                                                                             |
| `__fixtures__/`       | Corpos de exemplo copiados da documentação (dados fictícios)                                                                                        |

## Rotas de teste manual (somente desenvolvimento)

Respondem 404 a menos que `NODE_ENV === "development"` **e**
`JUDIT_LIVE_CALLS=enabled`. Não existem rotas de produção.

| Rota local                                                                         | Endpoint JUDIT                                |
| ---------------------------------------------------------------------------------- | --------------------------------------------- |
| `POST /api/dev/judit/entities`                                                     | `POST /entities`                              |
| `POST /api/dev/judit/lawsuits`                                                     | `POST /lawsuits`                              |
| `POST /api/dev/judit/lawsuits/count`                                               | `POST /lawsuits/count`                        |
| `POST /api/dev/judit/lawsuits/synthetic`                                           | `POST /lawsuits/synthetic`                    |
| `GET /api/dev/judit/lawsuits/{cnj}`                                                | `GET /lawsuits/{lawsuit_cnj}`                 |
| `POST /api/dev/judit/requests`                                                     | `POST /requests`                              |
| `GET /api/dev/judit/requests?created_at_gte&created_at_lte`                        | `GET /requests`                               |
| `GET /api/dev/judit/requests/{requestId}`                                          | `GET /requests/{request_id}`                  |
| `GET /api/dev/judit/responses?request_id=...`                                      | `GET /responses`                              |
| `GET /api/dev/judit/responses/{responseId}`                                        | `GET /responses/{response_id}`                |
| `GET /api/dev/judit/responses/tracking/{trackingId}?created_at_gte&created_at_lte` | `GET /responses/tracking/{origin_id}`         |
| `POST /api/dev/judit/tracking`                                                     | `POST /tracking`                              |
| `GET /api/dev/judit/tracking?page&page_size`                                       | `GET /tracking`                               |
| `GET /api/dev/judit/tracking/{trackingId}`                                         | `GET /tracking/{tracking_id}`                 |
| `PATCH /api/dev/judit/tracking/{trackingId}` (`{ recurrence }`)                    | `PATCH /tracking/{tracking_id}`               |
| `POST /api/dev/judit/tracking/{trackingId}/pause`                                  | `POST /tracking/{tracking_id}/pause`          |
| `POST /api/dev/judit/tracking/{trackingId}/resume`                                 | `POST /tracking/{tracking_id}/resume`         |
| `DELETE /api/dev/judit/tracking/{trackingId}?confirm=delete`                       | `DELETE /tracking/{tracking_id}` (definitivo) |

Exemplo (gasta crédito se o kill switch estiver ligado):

```bash
curl -X POST http://localhost:3000/api/dev/judit/lawsuits/count \
  -H 'content-type: application/json' \
  -d '{"searchType":"cnpj","searchKey":"A1B2C3D4/E5F6-68"}'
```

Status da rota local: 400 entrada inválida, 403 fora da allowlist,
422 `application_error`, 429 rate limit, 502 erro HTTP/resposta inesperada
da JUDIT, 503 kill switch, 504 timeout.

## Serviços

| Serviço  | URL base                             |
| -------- | ------------------------------------ |
| Lawsuits | https://lawsuits.production.judit.io |
| Requests | https://requests.production.judit.io |
| Tracking | https://tracking.production.judit.io |

Autenticação: header `api-key` (não `Authorization: Bearer`).
Fonte: <https://docs.judit.io/introduction/authentication>.

## Guarda de custo

1. **Kill switch.** Sem `JUDIT_LIVE_CALLS=enabled` no ambiente do servidor,
   `juditRequest` falha com `JuditLiveCallsDisabledError` antes de ler a chave
   ou chamar `fetch`.
2. **Allowlist.** Buscas por documento, nome ou CNJ passam por
   `assertAllowedSearchKey` em `guard.ts`. Começa só com o CNPJ de teste
   `A1B2C3D4E5F668`.
3. **Padrões seguros.** `on_demand` e `with_attachments` nunca são `true` por
   padrão (aplicado nas funções de serviço, fases 1 a 3).

**A allowlist não cobre chamadas sem documento.** Consultas por ID
(`getRequest`, `getTracking`, `pauseTracking`, `deleteTracking`...) e listagens
da conta inteira (`listRequests`, `listResponses`, `listTrackings`) passam só
pelo kill switch. Elas podem ler ou alterar trabalho criado fora deste app com a
mesma chave. Correção prevista: quando houver banco, registrar os IDs criados
pelo app e só permitir esses. Até lá, essas rotas só são chamadas por decisão
explícita.

**Limite da guarda:** ela protege apenas as chamadas feitas por esta
aplicação. A mesma chave usada no Postman, no curl ou em outro sistema passa
por fora dela e consome créditos normalmente.

## Erros

| Situação                                   | Classe                         |
| ------------------------------------------ | ------------------------------ |
| Kill switch desligado                      | `JuditLiveCallsDisabledError`  |
| Chave fora da allowlist / vazia            | `JuditGuardError`              |
| Falha de rede (DNS, conexão, TLS)          | `JuditNetworkError`            |
| Tempo limite (padrão 15s)                  | `JuditTimeoutError`            |
| HTTP 4xx/5xx                               | `JuditHttpError`               |
| HTTP 429 (com `Retry-After`/`X-RateLimit`) | `JuditRateLimitError`          |
| HTTP 200 com `application_error`           | `JuditApplicationError`        |
| HTTP 2xx com corpo não JSON ou fora do Zod | `JuditUnexpectedResponseError` |

Não há retentativa automática. Ver o comentário no topo de `client.ts`.

Fontes: <https://docs.judit.io/resource/errors>,
<https://docs.judit.io/essentialConcepts/rate-limits>.

## Cobrança por endpoint

Preenchido a cada fase, a partir dos selos das páginas da documentação.

| Endpoint                              | Cobrança (docs)                                                                                                                                                     | Fonte                                                                                                                              |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `POST /entities`                      | Cobrança por requisição. `on_demand`: "Mais caro"                                                                                                                   | <https://docs.judit.io/registration-data/registration-data>                                                                        |
| `POST /lawsuits`                      | Cobrança por requisição                                                                                                                                             | <https://docs.judit.io/cache-judit/hotstorage>                                                                                     |
| `POST /lawsuits` + on_demand          | Cobrança por requisição (selo da página on-demand)                                                                                                                  | <https://docs.judit.io/cache-judit/on-demand>                                                                                      |
| `POST /lawsuits/count`                | Cobrança por requisição                                                                                                                                             | <https://docs.judit.io/cache-judit/count>                                                                                          |
| `POST /lawsuits/synthetic`            | Cobrança por requisição                                                                                                                                             | <https://docs.judit.io/cache-judit/cache-grouped>                                                                                  |
| `GET /lawsuits/{lawsuit_cnj}`         | unknown, treat as billable (só existe no OpenAPI)                                                                                                                   | `/openapi/openapi/lawsuits.json`                                                                                                   |
| `POST /requests`                      | Cobrança por requisição (CNJ e documento). `should_search_superior_instances`: +30% (não exposto). Por documento: cobrado por cada 1.000 processos retornados (FAQ) | <https://docs.judit.io/requests/requests>, <https://docs.judit.io/requests/request-document>, <https://docs.judit.io/resource/faq> |
| `GET /requests`                       | unknown, treat as billable                                                                                                                                          | OpenAPI                                                                                                                            |
| `GET /requests/{request_id}`          | unknown, treat as billable                                                                                                                                          | OpenAPI                                                                                                                            |
| `GET /responses`                      | unknown, treat as billable                                                                                                                                          | OpenAPI                                                                                                                            |
| `GET /responses/{response_id}`        | unknown, treat as billable                                                                                                                                          | OpenAPI                                                                                                                            |
| `GET /responses/tracking/{origin_id}` | unknown, treat as billable                                                                                                                                          | OpenAPI                                                                                                                            |
| `POST /tracking` (CNJ)                | unknown, treat as billable (a página não tem selo). Gera execuções recorrentes enquanto ativo                                                                       | <https://docs.judit.io/tracking/tracking>                                                                                          |
| `POST /tracking` (CPF/CNPJ/OAB)       | "realizadas on-demand. Recomendamos verificar as condições de custo" (sem selo). Recorrente                                                                         | <https://docs.judit.io/tracking/tracking-document>                                                                                 |
| `GET /tracking`                       | unknown, treat as billable                                                                                                                                          | OpenAPI                                                                                                                            |
| `GET /tracking/{tracking_id}`         | unknown, treat as billable                                                                                                                                          | OpenAPI                                                                                                                            |
| `PATCH /tracking/{tracking_id}`       | unknown, treat as billable                                                                                                                                          | OpenAPI                                                                                                                            |
| `POST /tracking/{tracking_id}/pause`  | unknown, treat as billable                                                                                                                                          | <https://docs.judit.io/tracking/tracking>                                                                                          |
| `POST /tracking/{tracking_id}/resume` | unknown, treat as billable                                                                                                                                          | <https://docs.judit.io/tracking/tracking>                                                                                          |
| `DELETE /tracking/{tracking_id}`      | unknown, treat as billable                                                                                                                                          | <https://docs.judit.io/tracking/tracking>                                                                                          |

## Contradições e lacunas na documentação

Registradas em vez de escolhidas em silêncio.

1. **Formato do corpo de erro HTTP.** A página de erros diz que o corpo
   "sempre" segue `{ error: { name, message, data } }`, mas os exemplos de
   403 (autenticação) e 429 (rate limits) usam um formato plano
   `{ error: "...", message, code }`. O client aceita os dois.
2. **`USER_NOT_FOUND`.** A tabela de erros o lista como `error.name`; o
   exemplo de 401 da página de autenticação o coloca em `error.data`, com
   `name: "HttpUnauthorizedError"`.
3. **401 por limite de uso.** A página de autenticação lista "Limite de uso
   excedido" como causa possível de 401, não só chave inválida.
4. **Headers de rate limit.** A página de rate limits documenta só
   `X-RateLimit-Limit` e `X-RateLimit-Remaining`, nas respostas 200. A página
   de erros cita também `X-RateLimit-Reset` e `Retry-After` ("quando
   presente"). O formato de `Reset` não é documentado, então o client guarda
   os valores crus.
5. **`response_data.code` do application_error.** A página de erros mostra
   códigos texto (`LAWSUIT_NOT_FOUND`); o OpenAPI de `/responses` declara
   `number`. O schema aceita os dois.
6. **Onde o application_error aparece.** A página de erros mostra
   `responses[]`; o OpenAPI mostra `response_type` no topo (`/responses/{id}`)
   e em `page_data[]` (`/responses`). O client trata como erro o corpo cujo
   topo é `application_error` ou cujo `responses[]` é inteiramente de
   erros. Itens em `page_data[]` ficam para a função de serviço.
7. **Esquemas de autenticação no OpenAPI.** Os três specs declaram
   `jwtAuth` (Bearer) além de `apiKeyAuth`, enquanto a página de
   autenticação diz que o `api-key` é exclusivo. Usamos só `api-key`.
8. **Webhooks de tracking.** A página de callbacks fala em
   `tracking_response`; as páginas de tracking mostram `response_created`
   com `reference_type: "tracking"`. (Webhooks estão fora do escopo desta
   tarefa.)
9. **Documento de teste.** A maioria das páginas usa `A1B2C3D4/E5F6-68`; a
   página de contagem usa `-90`. Só `-68` tem dígitos verificadores válidos
   (`isValidCnpj`).
10. **Campo da lista em `POST /lawsuits`.** A página do Hot Storage mostra os
    processos em `response_data`; o OpenAPI e a página on-demand, em
    `lawsuits`. `searchLawsuits` aceita os dois e devolve sempre `lawsuits`.
    _Chamada real em 2026-10-14 (CNPJ fictício): **ainda não resolvida.**_ A
    rota de dev devolve a saída **depois** do `transform`, que sempre chama a
    lista de `lawsuits`; com qualquer um dos dois nomes, a saída seria igual.
    Confirmado só que a raiz não tem outros campos além de `has_lawsuits`,
    `request_id` e a lista (sem paginação, sem indicador de cache).
11. **"Nenhum processo" vem como HTTP 404.** A página do Hot Storage diz que
    `POST /lawsuits` responde 404 com `has_lawsuits: false` quando não acha
    processos. Tratamos esse corpo específico como resultado vazio; outro 404
    continua sendo erro.
12. **Rate limit.** A página do Hot Storage fala em 500 req/min; a página de
    rate limits, em 180 req/min por chave.
13. **`response_type` em `/entities`.** A página diz que é obrigatório e
    sempre `"entity"` (e que a falta gera 400), mas os exemplos da própria
    página não o enviam e o OpenAPI não o lista. Enviamos `"entity"`.
14. **`response_type` em `/lawsuits/count`.** A página o marca como
    obrigatório com `"lawsuits"`; os exemplos não o enviam e o enum do
    OpenAPI não contém `"lawsuits"` (só `application_*`, com padrão
    `lawsuits`). Enviamos `"lawsuits"`. _Observado em 2026-10-14:_ com
    `response_type: "lawsuits"` e `A1B2C3D4/E5F6-68`, a resposta foi HTTP 200
    `{ "total": 1, "limited": false }`. Isso prova que o campo não é
    rejeitado, não que a JUDIT o usa.
15. **`partners` em entidades.** O OpenAPI o marca como obrigatório; o
    exemplo de CPF não o traz. Tratado como opcional.
16. **Partes no Hot Storage.** O exemplo usa `document`/`document_type`; o
    OpenAPI usa `main_document`/`documents`. Não tipamos partes ainda.
    _Observado em 2026-10-14:_ a resposta real segue o **OpenAPI**
    (`main_document` + `documents: [{ document, document_type: "cnpj" }]`).
    A parte sem documento veio sem `main_document` e com `documents: []`, ou
    seja, `main_document` é opcional na prática.
17. **`GET /lawsuits/{lawsuit_cnj}`** não tem página na documentação, só o
    OpenAPI. Cobrança e significado de `all_att`/`saved_att`/
    `only_att_with_steps` são desconhecidos; esses parâmetros não são
    expostos.
18. **Cache não isenta cobrança.** A página de busca por CNJ diz que a ida ao
    tribunal acontece no máximo uma vez por dia por processo; consultas
    repetidas no mesmo dia voltam do cache, mas **cada requisição é cobrada**.
19. **Onde fica o "veio do cache?".** A tabela da página fala em
    `page_data[].cached_response`; o OpenAPI usa `cached` na raiz do item; o
    exemplo da própria página traz os dois dentro de `tags`.
    `responseCameFromCache` verifica os quatro lugares.
    _Observado em 2026-10-14 no `POST /lawsuits`:_ nenhum dos quatro
    aparece; `tags` trouxe só `dictionary_updated_at`. No Hot Storage, tudo
    vem do datalake, então talvez o indicador nem se aplique a esta rota.
20. **Paginação de `GET /requests`.** A página de paginação diz padrão 20 e
    máximo 1000; o OpenAPI de `GET /requests` diz padrão 10, mínimo 5 e
    máximo 100, e marca `page`, `page_size`, `created_at_gte` e
    `created_at_lte` como obrigatórios. Seguimos o OpenAPI (mais restritivo).
21. **`request_status`** aparece na raiz das listas de respostas nos exemplos,
    mas não no OpenAPI. Tratado como opcional.
22. **`cache_ttl_in_days` e `customer_key`.** A tabela da página por documento
    os lista no topo do corpo; o exemplo e o OpenAPI colocam
    `cache_ttl_in_days` dentro de `search`, e o OpenAPI coloca `customer_key`
    em `search.search_params.credential`. Seguimos exemplo e OpenAPI;
    `customer_key` não é exposto.
23. **Filtros em array na query de `/responses`.** O OpenAPI declara vários
    filtros como arrays, e a página mostra a sintaxe `["lawsuit"]` na URL,
    sem dizer se a forma repetida (`a=1&a=2`) também funciona. Não expomos
    esses filtros.
24. **Statuses de request.** O OpenAPI lista `pending`, `started`,
    `cancelling`, `cancelled` e `completed`; as páginas só mostram `pending`
    e `completed`. Não há documentação de um status de falha.
25. **ID malformado no exemplo de tracking.** O exemplo de
    `/responses/tracking` traz `request_id` com dígitos a mais
    (`...76afffc75849393`). Por isso os IDs não são validados como UUID.
26. **Campos do `PATCH /tracking/{id}`.** As páginas dizem que aceitam
    `recurrence`, `tags` e `search`; o OpenAPI só lista
    `notification_emails` e `callback_url`. Expomos só `recurrence`, a
    confirmar na primeira chamada real.
27. **`fixed_time`.** A página por CNJ o marca como obrigatório, mas os
    exemplos não o enviam; o OpenAPI o exige com padrão `false`. Enviamos
    sempre `false`.
28. **Statuses de tracking.** As páginas listam `created`, `updating`,
    `updated`, `paused` e `deleted`; o OpenAPI acrescenta `suspended`, sem
    explicação.
29. **`search_type` no tracking por documento.** A página diz que os valores
    possíveis incluem `lawsuit_id` (que não aparece no OpenAPI) e descreve
    `cpf`/`cnpj`/`oab` como "correspondem ao número do processo", o que
    contradiz o resto da página (eles identificam pessoas/empresas).
30. **Filtro `subject_codes` no tracking por documento.** O exemplo usa
    `{ keys, not_equal }`; o OpenAPI e as páginas de lawsuits usam
    `{ contains, not_contains }`. Nosso schema de filtro segue o OpenAPI.
31. **Cobrança do tracking** não tem selo em nenhuma das duas páginas, e a
    documentação não diz se cada execução recorrente é cobrada como uma
    requisição. Tratado como cobrável, por execução.
32. **Campo `limited` em `/lawsuits/count`.** _Observado em 2026-10-14._ A
    resposta real trouxe `"limited": false`, que não aparece na página nem no
    OpenAPI (`LawsuitsCount.Response.Post`). Significado desconhecido; a
    hipótese de "contagem truncada por um teto" não está confirmada. O schema
    é `looseObject`, então o campo passa sem quebrar a validação, mas não o
    tipamos nem o usamos até a JUDIT documentá-lo.
33. **Processo fictício do Hot Storage.** _Observado em 2026-10-14._ A página
    lista `phase` e `status` entre os campos principais, mas o item real não
    os trouxe (nem `last_step`); nosso schema já os trata como opcionais.
    Vários campos usam o texto `"NÃO INFORMADO"` em vez de `null` (`area`,
    `situation`, `judge`, `system`, `tribunal_url`): a interface deve tratar
    esse texto como ausência de dado. CNJ do processo fictício:
    `0000000-39.2026.8.26.0050` (dígitos verificadores válidos).
34. **Formato de `classifications`, `subjects`, `courts` e `side`.** A página
    do objeto processo (`/schemas/lawsuit-object`) mostra listas de textos
    (`["PROCEDIMENTO COMUM CÍVEL"]`), `courts` como texto e `side` em
    maiúsculas (`"ACTIVE"`); o exemplo do Hot Storage e a resposta real usam
    objetos `{ code, name }` e `side` como `"Active"`. O mapeamento
    `fromJuditLawsuit` (`src/features/processes/judit.ts`) aceita as duas
    formas em vez de tipar uma delas no schema.
