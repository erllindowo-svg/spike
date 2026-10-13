# Raio-X Jurídico

Aplicação para consultar informações de empresas e processos judiciais, criar
monitoramentos pela API da [JUDIT](https://docs.judit.io) e acompanhar
novidades recebidas via webhooks.

## Estado atual

**Fase 1 — fundação técnica.** Next.js (App Router) com TypeScript strict,
Tailwind CSS v4, shadcn/ui, Lucide React, MongoDB (driver oficial), leitura
validada de variáveis de ambiente, validação de
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

### Fonte de dados: `DATA_SOURCE`

A variável `DATA_SOURCE` escolhe de onde o app inteiro lê os dados:

- **`demo` (padrão):** dados fictícios em memória (`src/lib/mock-data.ts`).
  Recarregar a página restaura os dados iniciais. Páginas pré-renderizadas no
  build.
- **`db`:** MongoDB. Empresas e monitoramentos são lidos do banco, e criar um
  monitoramento grava nele (Server Action). Processos, alertas, webhooks e
  atividade ainda não são persistidos e aparecem vazios. Pausar, simular
  webhook e restaurar ficam ocultos.

Onde isso acontece:

- `src/lib/data.ts` é o único ponto que decide a origem. No modo `db`, chama
  `connection()` antes de consultar o banco, para que a consulta aconteça na
  requisição, e não no build.
- `src/lib/demo-store.tsx` mantém o estado da interface no navegador nos dois
  modos; no modo `db`, criar monitoramento chama
  `src/features/trackings/actions.ts`.
- O cabeçalho mostra qual modo está ativo.
- Use o mesmo `DATA_SOURCE` no build e na execução: no modo `demo` as páginas
  são geradas no build com os dados fictícios.

**Atenção:** ainda não há autenticação. No modo `db`, qualquer pessoa que
alcance a aplicação pode gravar monitoramentos (a Server Action é uma
requisição POST comum). Não exponha a aplicação publicamente nesse modo.

Ainda **não** implementado: chamadas à JUDIT pela interface, persistência de
processos, alertas e webhooks, recebimento real de webhooks e autenticação.

### Pontos levantados pela interface para o backend

- Processos ainda não têm coleção; o modelo de exibição está em
  `src/features/processes/types.ts`, com quase todos os campos opcionais.
- Alertas precisam referenciar o processo relacionado (`lawsuitCnj`).
- Reentregas com o mesmo `callbackId` são rejeitadas pelo índice único;
  a interface sugere contar essas reentregas (`duplicateDeliveries`).
- Os estados de monitoramento exibidos (`TrackingDisplayState`) são mapeados
  a partir dos status técnicos da JUDIT em `src/features/trackings/types.ts`;
  o mapeamento é provisório.

## Pré-requisitos

- Node.js 20.9 ou superior (recomendado: LTS atual).
- pnpm 12 (`npm install -g pnpm` ou via Corepack, onde disponível). A versão
  usada no projeto está fixada em `packageManager` no `package.json`.
- Um cluster MongoDB (o projeto usa o MongoDB Atlas) — necessário apenas para
  executar a aplicação com persistência. Os testes não precisam dele.

## Instalação

```bash
pnpm install
cp .env.example .env.local   # preencha os valores
pnpm dev                     # http://localhost:3000
```

## Variáveis de ambiente

| Variável           | Uso                                                                     |
| ------------------ | ----------------------------------------------------------------------- |
| `MONGODB_URI`      | String de conexão do MongoDB (`mongodb+srv://...` no Atlas).            |
| `MONGODB_DB`       | Nome do banco dentro do cluster. Opcional; padrão `raio_x`.             |
| `DATA_SOURCE`      | `demo` (padrão) ou `db`. Ver "Fonte de dados".                          |
| `JUDIT_API_KEY`    | Chave da API da JUDIT. Usada apenas no servidor.                        |
| `JUDIT_LIVE_CALLS` | `enabled` libera chamadas reais à JUDIT; qualquer outro valor bloqueia. |

Regras:

- As variáveis são lidas somente no servidor, por `getServerEnv()`
  (`src/lib/env.ts`), módulo protegido por `server-only`.
- Nunca use o prefixo `NEXT_PUBLIC_` para segredos, nunca versione arquivos
  `.env*` (apenas `.env.example`) e não registre a chave em logs.
- O build não exige credenciais: elas são validadas apenas quando usadas.
- Na Vercel, cadastre as variáveis em _Project Settings → Environment Variables_.

### MongoDB Atlas

O cliente (`src/db/index.ts`) abre uma conexão por instância do servidor e a
reaproveita entre requisições. Na primeira conexão, cria os índices definidos
em `src/db/collections.ts` (`createIndex` não faz nada se o índice já existe).
No Atlas, libere o IP de onde a aplicação roda em _Network Access_ e use um
usuário de banco com permissão apenas no banco do projeto.

## Comandos

| Comando             | Descrição                                                |
| ------------------- | -------------------------------------------------------- |
| `pnpm dev`          | Servidor de desenvolvimento.                             |
| `pnpm build`        | Build de produção.                                       |
| `pnpm start`        | Inicia o build de produção.                              |
| `pnpm lint`         | ESLint (falha com qualquer aviso).                       |
| `pnpm typecheck`    | Gera os tipos de rotas do Next.js e roda `tsc --noEmit`. |
| `pnpm format`       | Formata os arquivos com Prettier.                        |
| `pnpm format:check` | Verifica a formatação sem alterar arquivos.              |
| `pnpm test`         | Testes (Vitest). Sem rede e sem banco externo.           |

## Estrutura

```
src/
  app/                    Rotas e layouts (App Router); (app)/ contém o shell
  components/
    ui/                   Componentes shadcn/ui
    layout/               Sidebar, cabeçalho e busca global
    shared/               Badges, estados vazios, gráfico, visualizador JSON
  db/
    models.ts             Tipos dos dados usados pela aplicação
    collections.ts        Coleções, documentos e índices do MongoDB
    index.ts              Conexão com o MongoDB (somente servidor)
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

MongoDB, acessado pelo driver oficial (`mongodb`). Cada documento usa um UUID
em texto como `_id`; as funções de persistência o convertem para `id`. Não há
migrations: as coleções nascem na primeira inserção e os índices são criados
por `ensureIndexes` (`src/db/collections.ts`) na conexão.

- **companies** — CNPJ único (14 caracteres, sem máscara), razão social e
  situação cadastral opcionais.
- **trackings** — monitoramentos; `juditTrackingId` único quando preenchido
  (nulo até a JUDIT confirmar), tipo de pesquisa (`cnpj` | `cnj`),
  identificador, status bruto retornado pela JUDIT e recorrência em dias. O
  índice único parcial `trackings_active_search_key_unique` permite no máximo
  um monitoramento não excluído por identificador. Como o MongoDB não aceita
  "diferente de" no filtro de um índice parcial, o documento guarda um campo
  `active` (falso quando `status` é `deleted`), que quem alterar o status
  precisa manter coerente (`activeFor`).
- **webhook_events** — `callbackId` único quando preenchido, para impedir
  processamento duplicado; tipo/referência do evento, payload original e
  status de processamento (`pending`, `processing`, `processed`, `failed`,
  `ignored`).
- **alerts** — alertas ligados opcionalmente a empresa e evento de origem;
  `readAt` nulo indica não lido.

Campos vindos da API são `null` sempre que a JUDIT pode não fornecê-los.

Diferenças em relação a um banco SQL que importam aqui:

- **Sem chaves estrangeiras.** Nada impede um `companyId` que não exista; a
  coerência depende das funções de persistência.
- **Sem validação de formato no banco.** A validação Zod no servidor é a única
  barreira contra dados malformados.
- **Transações** exigem replica set, o que o Atlas já oferece. Nenhuma função
  usa transação por enquanto.

Funções de persistência (somente servidor):

- `src/features/companies/db.ts` — `listCompanies`, `getCompanyByCnpj` e
  `ensureCompany` (cria a empresa uma única vez por CNPJ).
- `src/features/trackings/db.ts` — `listTrackings` e `createTracking`, que
  valida a entrada no servidor e devolve `duplicate` quando o índice único
  recusa a inserção. Só registra localmente: não cria nada na JUDIT.

Os testes dessas funções rodam contra um MongoDB real e temporário
([mongodb-memory-server](https://github.com/typegoose/mongodb-memory-server),
dependência só de desenvolvimento), com os mesmos índices da aplicação
(`src/db/test-db.ts`). A primeira execução baixa o binário do `mongod` (fica em
`~/.cache/mongodb-binaries`); depois, rodam sem rede e sem `MONGODB_URI`.

## Deploy

O destino previsto é a Vercel. Configure `MONGODB_URI`, `JUDIT_API_KEY` e,
se quiser outro nome de banco, `MONGODB_DB` no projeto. No Atlas, libere o
acesso de rede para a Vercel.
