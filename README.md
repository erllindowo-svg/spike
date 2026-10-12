# Raio-X Jurídico

Aplicação para consultar informações de empresas e processos judiciais, criar
monitoramentos pela API da [JUDIT](https://docs.judit.io) e acompanhar
novidades recebidas via webhooks.

## Estado atual

**Fase 1 — fundação técnica.** Next.js (App Router) com TypeScript strict,
Tailwind CSS v4, shadcn/ui, Lucide React, Drizzle ORM com schema inicial e
primeira migration, leitura validada de variáveis de ambiente, validação de
CNPJ (incluindo o formato alfanumérico) e de número CNJ, ESLint e Prettier.

**Fase 2 — interface visual com dados de demonstração.** Telas navegáveis:

| Rota               | Conteúdo                                                                      |
| ------------------ | ----------------------------------------------------------------------------- |
| `/`                | Visão geral: indicadores, distribuição processual, atividade e monitoramentos |
| `/empresas`        | Listagem com busca por razão social ou CNPJ                                   |
| `/empresas/[cnpj]` | Panorama da empresa, processos (com painel lateral) e monitoramentos          |
| `/processos/[cnj]` | Detalhes e movimentações de um processo                                       |
| `/monitoramentos`  | Acompanhamento e criação de monitoramentos por CNPJ ou CNJ                    |
| `/alertas`         | Central de alertas com filtros e estado de leitura                            |
| `/webhooks`        | Diagnóstico de callbacks: envelope, processamento, payload e simulação        |
| `/configuracoes`   | Situação das integrações e restauração dos dados de demonstração              |

Toda a interface usa **dados fictícios em memória**:

- `src/lib/mock-data.ts` concentra as coleções tipadas (empresas, processos,
  monitoramentos, alertas, eventos de webhook e atividade).
- `src/lib/data.ts` expõe funções de consulta usadas pelas páginas; é o ponto
  a ser trocado por consultas ao banco/JUDIT.
- `src/lib/demo-store.tsx` mantém o estado mutável da sessão (criar
  monitoramento, marcar alertas como lidos, simular eventos). Recarregar a
  página restaura os dados iniciais.

Ainda **não** implementado: chamadas à JUDIT, uso da API key, persistência no
PostgreSQL, recebimento real de webhooks e autenticação. Toda ação que
dependeria dessas integrações informa que ocorreu apenas em modo de
demonstração.

### Pontos levantados pela interface para o backend

- Processos ainda não têm tabela; o modelo de exibição está em
  `src/features/processes/types.ts`, com quase todos os campos opcionais.
- Alertas precisam referenciar o processo relacionado (`lawsuitCnj`).
- Reentregas com o mesmo `callback_id` são rejeitadas pela restrição `UNIQUE`;
  a interface sugere contar essas reentregas (`duplicateDeliveries`).
- Os estados de monitoramento exibidos (`TrackingDisplayState`) são mapeados
  a partir dos status técnicos da JUDIT em `src/features/trackings/types.ts`;
  o mapeamento é provisório.

## Pré-requisitos

- Node.js 20.9 ou superior (recomendado: LTS atual).
- pnpm 12 (`npm install -g pnpm` ou via Corepack, onde disponível). A versão
  usada no projeto está fixada em `packageManager` no `package.json`.
- Um banco PostgreSQL 13+ (ex.: Neon, Supabase ou local) — necessário apenas
  para aplicar migrations e, futuramente, executar consultas.

## Instalação

```bash
pnpm install
cp .env.example .env.local   # preencha os valores
pnpm dev                     # http://localhost:3000
```

## Variáveis de ambiente

| Variável        | Uso                                                             |
| --------------- | --------------------------------------------------------------- |
| `DATABASE_URL`  | String de conexão PostgreSQL (`postgresql://...`).              |
| `JUDIT_API_KEY` | Chave da API da JUDIT. Usada apenas no servidor (etapa futura). |

Regras:

- As variáveis são lidas somente no servidor, por `getServerEnv()`
  (`src/lib/env.ts`), módulo protegido por `server-only`.
- Nunca use o prefixo `NEXT_PUBLIC_` para segredos, nunca versione arquivos
  `.env*` (apenas `.env.example`) e não registre a chave em logs.
- O build não exige credenciais: elas são validadas apenas quando usadas.
- Na Vercel, cadastre as variáveis em _Project Settings → Environment Variables_.

### PostgreSQL gerenciado

O cliente usa o driver `postgres` (postgres.js) com `prepare: false`, o que o
torna compatível com poolers em modo transação (Supabase, Neon, PgBouncer).
Em ambientes serverless, prefira a string de conexão **com pooling** do
provedor em `DATABASE_URL`. Se o pooler não suportar DDL, rode as migrations
com a string de conexão direta.

## Comandos

| Comando             | Descrição                                                   |
| ------------------- | ----------------------------------------------------------- |
| `pnpm dev`          | Servidor de desenvolvimento.                                |
| `pnpm build`        | Build de produção.                                          |
| `pnpm start`        | Inicia o build de produção.                                 |
| `pnpm lint`         | ESLint (falha com qualquer aviso).                          |
| `pnpm typecheck`    | Gera os tipos de rotas do Next.js e roda `tsc --noEmit`.    |
| `pnpm format`       | Formata os arquivos com Prettier.                           |
| `pnpm format:check` | Verifica a formatação sem alterar arquivos.                 |
| `pnpm db:generate`  | Gera migrations a partir de `src/db/schema.ts` (sem banco). |
| `pnpm db:migrate`   | Aplica as migrations (requer `DATABASE_URL`).               |
| `pnpm db:studio`    | Abre o Drizzle Studio (requer `DATABASE_URL`).              |

Os comandos `db:*` carregam `.env` e `.env.local` com as mesmas regras do
Next.js (`drizzle.config.ts`).

## Estrutura

```
drizzle/                  Migrations SQL geradas pelo Drizzle Kit
src/
  app/                    Rotas e layouts (App Router); (app)/ contém o shell
  components/
    ui/                   Componentes shadcn/ui
    layout/               Sidebar, cabeçalho e busca global
    shared/               Badges, estados vazios, gráfico, visualizador JSON
  db/
    schema.ts             Tabelas, enums, índices e tipos inferidos
    index.ts              Cliente Drizzle (somente servidor)
  features/
    activity/             Feed de atividade recente
    alerts/               Central de alertas
    companies/            Empresas (validação de CNPJ, listagem, detalhe)
    overview/             Visão geral
    processes/            Processos (validação de CNJ, tabela, detalhes)
    settings/             Configurações
    trackings/            Monitoramentos (tipos, rótulos, tabela, modal)
    webhooks/             Diagnóstico de callbacks
  lib/
    data.ts               Funções de consulta aos dados de demonstração
    demo-store.tsx        Estado em memória da demonstração
    env.ts                Variáveis de ambiente do servidor
    format.ts             Formatação de datas, números e moeda (pt-BR)
    judit/                Integração com a API da JUDIT (futuro)
    mock-data.ts          Dados fictícios
    utils.ts              Utilitários compartilhados (`cn`)
```

## Banco de dados

- **companies** — CNPJ único (14 caracteres, sem máscara), razão social e
  situação cadastral opcionais.
- **trackings** — monitoramentos; `judit_tracking_id` único (nulo até a JUDIT
  confirmar), tipo de pesquisa (`cnpj` | `cnj`), identificador, status bruto
  retornado pela JUDIT e recorrência em dias.
- **webhook_events** — `callback_id` único para impedir processamento
  duplicado, tipo/referência do evento, payload original em JSONB e status de
  processamento (`pending`, `processing`, `processed`, `failed`, `ignored`).
- **alerts** — alertas ligados opcionalmente a empresa e evento de origem;
  `read_at` nulo indica não lido.

Campos vindos da API são opcionais sempre que a JUDIT pode não fornecê-los.

## Deploy

O destino previsto é a Vercel. Configure `DATABASE_URL` e `JUDIT_API_KEY` no
projeto e aplique as migrations (`pnpm db:migrate`) antes do primeiro deploy
que dependa do banco.
