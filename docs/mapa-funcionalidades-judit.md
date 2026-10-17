# Mapa das funcionalidades da JUDIT

Pedido do usuário (2026-10-16, ditado, resumido): mapear todas as
funcionalidades úteis da JUDIT que dá para integrar como uma feature única,
diferenciando-as mesmo quando o endpoint é o mesmo, porque o projeto quer
demonstrar todas as capacidades; vale ser redundante.

Fonte: documentação pública da JUDIT, lida em 2026-10-16 (links em cada
linha). "No app" descreve o código de hoje. Onde a documentação não diz algo
(custo, por exemplo), está escrito "não informado"; nada aqui foi testado ao
vivo além do que o diário registra.

## Como ler

Três camadas, do técnico para o produto:

1. **Endpoint**: a rota HTTP (`POST /requests`).
2. **Modalidade**: a combinação de endpoint e parâmetros que muda o que volta
   (`search_type`, `response_type`, `on_demand`, `with_attachments`...).
3. **Feature**: o que a pessoa vê e escolhe na tela.

O mesmo endpoint serve a várias features. `POST /requests` faz a consulta
processual por CNJ, o histórico por documento, os mandados de prisão e a
execução penal; `POST /lawsuits` faz a lista do datalake e a consulta
processual atualizada no tribunal; `POST /tracking` faz os quatro tipos de
monitoramento. Para o produto, cada uma é uma feature separada, porque muda
o que a pessoa pede, o tempo de resposta, a fonte e o custo.

Identificadores: CPF, CNPJ, OAB, Nome, CNJ (número do processo) e RJI
(número do BNMP para mandados).

## Consultas pontuais

| #   | Feature                                                       | Endpoint e modalidade                                                                                                      | Fluxo               | Identificadores                | Custo                                                        | No app                                                                  |
| --- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------- | ------------------------------ | ------------------------------------------------------------ | ----------------------------------------------------------------------- |
| F01 | Contagem de processos ("tem processo?")                       | `POST /lawsuits/count` ([doc](https://docs.judit.io/cache-judit/count))                                                    | síncrono, datalake  | CPF, CNPJ, OAB, Nome, CNJ, RJI | por requisição                                               | client e rota de dev; sem tela                                          |
| F02 | Resumo agrupado (por tribunal, área, fase, classe, polo...)   | `POST /lawsuits/synthetic` ([doc](https://docs.judit.io/cache-judit/cache-grouped))                                        | síncrono, datalake  | CPF, CNPJ, OAB, Nome           | por requisição                                               | client e rota de dev; sem tela                                          |
| F03 | Lista de processos do datalake (consulta síncrona)            | `POST /lawsuits` ([doc](https://docs.judit.io/cache-judit/hotstorage))                                                     | síncrono, datalake  | CPF, CNPJ, OAB, Nome, CNJ      | por requisição                                               | na tela, só CNPJ                                                        |
| F04 | Processo atualizado no tribunal, sem sair do síncrono         | `POST /lawsuits` com CNJ e `on_demand` (`cache_ttl_in_days` opcional) ([doc](https://docs.judit.io/cache-judit/on-demand)) | síncrono, até 3 min | CNJ                            | por requisição                                               | client aceita; sem tela                                                 |
| F05 | Processo por CNJ no datalake                                  | `GET /lawsuits/{cnj}` (só no OpenAPI)                                                                                      | síncrono            | CNJ                            | não informado                                                | client e rota de dev; sem tela (`/processos/[cnj]` dá 404 no modo `db`) |
| F06 | Consulta processual completa por CNJ                          | `POST /requests` com `lawsuit_cnj` ([doc](https://docs.judit.io/requests/requests))                                        | assíncrono          | CNJ                            | por requisição                                               | client aceita; sem tela                                                 |
| F07 | Histórico por documento (capa e partes de todos os processos) | `POST /requests` ([doc](https://docs.judit.io/requests/request-document))                                                  | assíncrono          | CPF, CNPJ, OAB, Nome           | por requisição; on-demand custa mais                         | na tela, só CNPJ (comum e on-demand)                                    |
| F08 | Dados cadastrais (razão social, situação, sócios, endereços)  | `POST /entities` ([doc](https://docs.judit.io/registration-data/registration-data))                                        | síncrono            | CPF, CNPJ, Nome                | por requisição; on-demand (Receita em tempo real) custa mais | na tela, só CNPJ, sem on-demand                                         |
| F09 | Mandados de prisão (BNMP)                                     | `POST /requests` com `response_type: "warrant"` ([doc](https://docs.judit.io/criminal-consultation/warrant))               | assíncrono          | CPF, Nome, RJI                 | por requisição                                               | não                                                                     |
| F10 | Execução penal                                                | `POST /requests` com `response_type: "execution"` ([doc](https://docs.judit.io/criminal-consultation/criminal-execution))  | assíncrono          | CPF, CNPJ, Nome, CNJ           | por requisição                                               | não                                                                     |

Opções que viram features próprias, por mudarem o resultado:

| #   | Feature                                                           | Onde se liga                                                                                                           | No app                         |
| --- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| F11 | Resumo do processo com IA                                         | `judit_ia: ["summary"]` em F06 ([doc](https://docs.judit.io/requests/requests)); custo não informado                   | não                            |
| F12 | Anexos do processo (até 1.000 por requisição)                     | `with_attachments` em F06; download por `GET /lawsuits/{cnj}/{instância}/attachments/{id}`; aumenta o custo            | não                            |
| F13 | PDF do mandado                                                    | `with_attachments` em F09; download por `GET /warrants/{cnj}/attachments/{id}`                                         | não                            |
| F14 | Filtros avançados (tribunal, polo, classe, assunto, valor, datas) | `search_params.filter` em F01, F02, F03 e F07 ([cobertura de tribunais](https://docs.judit.io/resource/courtCoverage)) | client aceita; sem tela        |
| F15 | Partes inferidas pelo nome (risco de homônimo)                    | `with_inferred_parties` em F03 e no monitoramento por documento                                                        | client aceita em F03; sem tela |
| F16 | Instância específica                                              | `search_params.lawsuit_instance` em F06 e monitoramentos                                                               | não                            |

## Monitoramentos (recorrentes)

| #   | Feature                                                                     | Endpoint e modalidade                                                                                                | Identificadores                        | Custo                         | No app       |
| --- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | ----------------------------- | ------------ |
| F17 | Movimentações de um processo                                                | `POST /tracking` com `lawsuit_cnj` ([doc](https://docs.judit.io/tracking/tracking))                                  | CNJ                                    | recorrente                    | sim          |
| F18 | Processos novos de um documento                                             | `POST /tracking` com `cpf`, `cnpj` ou `oab` ([doc](https://docs.judit.io/tracking/tracking-document))                | CPF, CNPJ, OAB                         | recorrente                    | sim, só CNPJ |
| F19 | Publicações no Diário Oficial (DJEN)                                        | `POST /tracking` com `response_type: "communication"` ([doc](https://docs.judit.io/tracking/tracking-communication)) | CPF, CNPJ, OAB, Nome ou qualquer termo | diário                        | não          |
| F20 | Processos novos por filtros, sem documento                                  | `POST /tracking` com `search_type: "custom"` ([doc](https://docs.judit.io/tracking/tracking-custom))                 | nenhum (filtros)                       | preço próprio, pelo comercial | não          |
| F21 | Só movimentações com certos termos ("sentença", "intimação")                | `notification_filters.step_terms` em F17                                                                             | CNJ                                    | não informado                 | não          |
| F22 | E-mail da própria JUDIT a cada atualização                                  | `notification_emails` em F17 a F19                                                                                   | —                                      | não informado                 | não          |
| F23 | Gestão: listar, detalhar, pausar, reativar, excluir, histórico de respostas | `GET /tracking`, `GET /tracking/{id}`, `POST .../pause`, `POST .../resume`, `DELETE`, `GET /responses/tracking/{id}` | —                                      | não informado                 | sim          |

## Entrega, acompanhamento e conta

| #   | Feature                                                          | Endpoint                                                                                                    | Custo                           | No app                            |
| --- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------- | --------------------------------- |
| F24 | Resultado por webhook                                            | `callback_url` nas consultas e monitoramentos ([doc](https://docs.judit.io/webhook/callbacks))              | —                               | sim, só nas consultas assíncronas |
| F25 | Resultado por polling                                            | `GET /requests/{id}`, `GET /responses`                                                                      | não informado                   | sim                               |
| F26 | Histórico de requisições da conta (consumo por período)          | `GET /requests?created_at_gte=...` ([doc](https://docs.judit.io/resource/consumption/history))              | não informado                   | client e rota de dev; sem tela    |
| F27 | Saldo de créditos (pré-pago)                                     | `GET users.production.judit.io/credits/balance` ([doc](https://docs.judit.io/resource/consumption/credits)) | a página não marca como cobrada | não                               |
| F28 | Consumo do ciclo de faturamento (consumido, teto, restante)      | `GET /billing/consumption` ([doc](https://docs.judit.io/resource/consumption/current))                      | a página não marca como cobrada | não                               |
| F29 | Cofre de credenciais (processos em segredo, tribunais com login) | `crawler.prod.judit.io/credentials` ([doc](https://docs.judit.io/essentials/cofre-de-credenciais))          | não informado                   | não (adiado pelo usuário)         |

## Fora do produto, registrados para não se perderem

| #   | O que é                                                                                                                                                                          | Por que fica fora                                                                    |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| F30 | Consulta customizada por filtros, em lote ([doc](https://docs.judit.io/requests/custom-search)) e a File Transfer API ([doc](https://docs.judit.io/file-transfer/file-transfer)) | é um relatório sob demanda, habilitado pelo comercial, entregue por arquivo          |
| F31 | Judit Miner: precatórios e execuções de sentença ([doc](https://docs.judit.io/miner/introduction))                                                                               | outro produto: host próprio, créditos próprios e permissão `miner_enabled`           |
| F32 | MCP da documentação ([doc](https://docs.judit.io/resource/mcp))                                                                                                                  | ferramenta para quem desenvolve (o agente usa neste projeto), não uma feature do app |

## O que diferencia features do mesmo endpoint

- **O que volta:** lista de processos (F03), capa e partes (F07), processo
  completo (F06), contagem (F01), agregados (F02), cadastro (F08), mandado
  (F09), execução penal (F10).
- **De onde vem:** datalake (rápido, pode estar defasado), fontes externas,
  tribunal em tempo real (on-demand, mais caro e mais lento).
- **Quando chega:** na própria resposta (síncrono), depois (assíncrono, por
  webhook ou polling), ou de novo a cada N dias (monitoramento).
- **Quanto custa:** por requisição, recorrente, ou com preço próprio.

## Sugestão de organização (não decidida)

- **Consultar** (pontuais): F01 a F10, com F11 a F16 como opções.
- **Monitorar**: F17 a F20, com F21 e F22 como opções; F23 nas próprias
  telas.
- **Acompanhar**: Consultas (histórico), Alertas e Diagnóstico (F24 a F26).
- **Conta**: F27 e F28 em Configurações ou no Dashboard; F29 depois.

No código, o caminho natural é ampliar o catálogo que já existe
(`QUERY_MODES` e `TRACKING_MODES` em `src/features/queries/modes.ts`) para
cobrir cada feature, com os identificadores aceitos por ela. Assim as telas
leem as alternativas do catálogo, em vez de cada uma conhecer os
identificadores por conta própria (ligação com a escolha R1 em
`docs/etapa-7-escopo.md`).

## Estado no app em 2026-10-16 (fim do círculo 2 da etapa 7)

| Feature                                                   | No app                                                                                                                                                                                                              |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F01 contagem, F02 resumo agrupado                         | Consultar (CNPJ, CPF)                                                                                                                                                                                               |
| F03 lista do datalake                                     | Consultar e página da parte (CNPJ, CPF)                                                                                                                                                                             |
| F04 processo atualizado no tribunal, F05 processo na base | Consultar e página do processo (CNJ)                                                                                                                                                                                |
| F06 consulta processual completa, F11 resumo por IA       | Consultar (CNJ); resultado no histórico                                                                                                                                                                             |
| F07 histórico por documento                               | Consultar e página da parte (CNPJ, CPF; comum e on-demand)                                                                                                                                                          |
| F08 dados cadastrais                                      | Consultar (também on-demand, na Receita), adicionar parte e página da parte                                                                                                                                         |
| F09 mandados de prisão                                    | Consultar e página da pessoa (CPF)                                                                                                                                                                                  |
| F10 execução penal                                        | Consultar e página da parte (CNPJ, CPF)                                                                                                                                                                             |
| F17 monitoramento processual, F21 filtro de termos        | Monitoramentos (CNJ)                                                                                                                                                                                                |
| F18 monitoramento por documento                           | Monitoramentos (CNPJ, CPF)                                                                                                                                                                                          |
| F23 gestão de monitoramentos                              | Monitoramentos                                                                                                                                                                                                      |
| F24 webhook, F25 polling                                  | Consultas assíncronas (webhook só com a origem pública configurada)                                                                                                                                                 |
| F27 saldo de créditos, F28 consumo do ciclo               | Configurações, por clique                                                                                                                                                                                           |
| Fora, por enquanto                                        | F12 e F13 anexos, F14 filtros avançados, F15 partes inferidas, F16 instância, F19 Diário Oficial, F20 monitoramento por filtros, F22 e-mails da JUDIT, F26 histórico da conta, F29 cofre; F30 a F32 fora do produto |
