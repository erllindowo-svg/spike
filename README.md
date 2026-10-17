# Raio-X Jurídico

App para consultar empresas, pessoas e processos judiciais pela API da
[JUDIT](https://docs.judit.io), monitorá-los e receber as novidades por
webhook. As respostas ficam numa base própria no MongoDB, para serem lidas de
novo sem pagar outra consulta.

- **Protótipo navegável, só com dados fictícios:** branch
  [`prototipo`](https://github.com/erllindowo-svg/spike/tree/prototipo)
  (tag `prototype-v1.0.0`). Não precisa de banco nem de chave.
- **Como o projeto foi feito:** diário de aprendizado, catálogo de falhas,
  escopo e relatórios de progresso estão na tag
  [`historico-etapa-7`](https://github.com/erllindowo-svg/spike/tree/historico-etapa-7/docs).

## O que o app faz

| Tela                     | O que mostra                                                                                                    |
| ------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `/` Consultar            | Reconhece CPF, CNPJ, CNJ, OAB, RJI ou nome e oferece as perguntas que a JUDIT responde, com o custo de cada uma |
| `/acervo`                | Tudo o que já foi pesquisado, monitorado ou salvo, com busca                                                    |
| `/acervo/[tipo]/[chave]` | A ficha de um assunto: o que a base própria sabe, monitoramentos, consultas feitas e as perguntas que faltam    |
| Sino (topo)              | Alertas gerados pelos webhooks; clicar abre a ficha com o processo do alerta                                    |
| Carteira (topo)          | Consumo do ciclo e saldo de créditos, lidos na JUDIT quando aberta                                              |
| `/webhooks`              | Diagnóstico das entregas recebidas, com reprocessamento (vista de suporte)                                      |
| `/configuracoes`         | Situação de cada integração (sem mostrar valores), proteção de custo e vista de suporte                         |

## Requisitos

- Node.js 20.9 ou superior e pnpm 12 (versão fixada em `packageManager`).
- Um banco MongoDB (o projeto usa o MongoDB Atlas).
- Uma chave da API da JUDIT.

## Configurar e rodar

```bash
pnpm install
cp .env.example .env.local   # preencha os valores
pnpm env:check               # confere o que foi lido, sem mostrar segredos
pnpm dev                     # http://127.0.0.1:3000
```

Sem `MONGODB_URI` ou `JUDIT_API_KEY`, o app não abre: a primeira tela lista o
que falta e como configurar. Para as consultas saírem do servidor, defina
também `JUDIT_LIVE_CALLS=enabled`.

| Variável                      | Uso                                                                                                      |
| ----------------------------- | -------------------------------------------------------------------------------------------------------- |
| `MONGODB_URI`                 | **Obrigatória.** String de conexão (`mongodb+srv://…` no Atlas)                                          |
| `JUDIT_API_KEY`               | **Obrigatória.** Chave da API da JUDIT, usada só no servidor                                             |
| `JUDIT_LIVE_CALLS`            | `enabled` libera as chamadas reais; qualquer outro valor barra todas antes de sair                       |
| `MONGODB_DB`                  | Nome do banco no cluster (padrão `raio_x`)                                                               |
| `JUDIT_ALLOWLIST`             | Modo restrito (só os documentos de teste): vazio liga, `disabled` desliga, `locked` trava ligado         |
| `JUDIT_MAX_CALLS_PER_MINUTE`  | Limite próprio de chamadas por minuto (padrão 30)                                                        |
| `JUDIT_DAILY_CALL_LIMIT`      | Teto diário de chamadas cobradas (padrão 50)                                                             |
| `JUDIT_WEBHOOK_TOKEN`         | Segredo do webhook (32+ caracteres); sem ele, a rota `/api/webhooks/judit` responde 404                  |
| `JUDIT_WEBHOOK_PUBLIC_ORIGIN` | Endereço `https` onde a JUDIT alcança o app; com ele, as consultas assíncronas pedem entrega por webhook |
| `JUDIT_WEBHOOK_FULL_PAYLOAD`  | `enabled` grava o payload inteiro de cada webhook (só para diagnóstico)                                  |

O `.env.example` explica cada uma. Nunca use `NEXT_PUBLIC_` para segredos nem
versione arquivos `.env*` com valores.

**Atenção:** o app não tem login. Quem alcança o servidor consulta (com
cobrança), cria monitoramentos e lê os dados guardados. Rode localmente e não
o publique sem autenticação.

## Comandos

| Comando             | Descrição                                                         |
| ------------------- | ----------------------------------------------------------------- |
| `pnpm dev`          | Servidor de desenvolvimento                                       |
| `pnpm build`        | Build de produção (não exige credenciais)                         |
| `pnpm start`        | Serve o build de produção                                         |
| `pnpm lint`         | ESLint (falha com qualquer aviso)                                 |
| `pnpm typecheck`    | Gera os tipos de rotas do Next.js e roda `tsc --noEmit`           |
| `pnpm test`         | Testes (Vitest), sem rede; os de banco usam um MongoDB temporário |
| `pnpm format:check` | Verifica a formatação (Prettier)                                  |
| `pnpm env:check`    | Mostra as variáveis lidas, sem valores; `--db` testa a conexão    |

Na primeira execução, os testes de banco baixam o binário do `mongod`
([mongodb-memory-server](https://github.com/typegoose/mongodb-memory-server)).

## Stack

Next.js 16 (App Router, Cache Components, Server Actions), React 19,
TypeScript strict, Tailwind CSS v4, shadcn/ui (Base UI), MongoDB (driver
oficial), Zod e Vitest.

## Estrutura

```
src/
  app/
    (app)/            Telas; o layout mostra a tela de configuração se faltar algo
    api/webhooks/     Rota que recebe os webhooks da JUDIT
    api/dev/          Rotas de teste manual da JUDIT (só em desenvolvimento)
  db/                 Conexão, coleções, índices e tipos do MongoDB
  lib/
    judit/            Cliente da JUDIT: erros, proteções de custo, schemas (ver o README da pasta)
    data.ts           Leituras do banco usadas pelas páginas
    app-store.tsx     Listas compartilhadas pelas telas e as ações que as mudam
    env.ts            Variáveis de ambiente do servidor
  features/
    consult/          Página Consultar e catálogo de perguntas
    subjects/         Acervo e ficha de cada assunto
    base/             Base própria: o que as respostas da JUDIT trouxeram
    queries/          Consultas assíncronas e histórico
    trackings/        Monitoramentos
    webhooks/         Recebimento, idempotência e processamento (ver o README da pasta)
    alerts/           Alertas e menu do sino
    parties/          Empresas e pessoas
    search/           Busca do acervo
    settings/         Configurações, carteira, proteção de custo, vista de suporte
```
