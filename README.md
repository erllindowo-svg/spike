# Raio-X Jurídico — protótipo

Protótipo navegável do **Raio-X Jurídico**, um app para consultar empresas,
pessoas e processos judiciais pela API da [JUDIT](https://docs.judit.io),
monitorá-los e receber as novidades por webhook.

**Tudo aqui é fictício.** O protótipo não tem banco de dados, não chama a
JUDIT e não recebe webhooks: os dados vêm de `src/lib/mock-data.ts` e o que
você muda fica só na memória da aba (recarregar restaura o início). O selo
"Demonstração" no topo lembra isso em todas as telas.

O app real, ligado ao MongoDB e à JUDIT, está na branch
[`main`](https://github.com/erllindowo-svg/spike/tree/main). Este protótipo
saiu dele no fim da etapa 7 e fica marcado com a tag `prototype-v1.0.0`.

## O que dá para ver

| Tela                     | O que mostra                                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `/` Consultar            | Digite um CPF, CNPJ ou número de processo; o app reconhece o tipo e oferece as perguntas que a JUDIT responde |
| `/acervo`                | Tudo o que já foi pesquisado, monitorado ou salvo, com busca                                                  |
| `/acervo/[tipo]/[chave]` | A ficha de um assunto: processos, monitoramentos, consultas feitas e o que ainda não se sabe                  |
| Sino (topo)              | Histórico de alertas; clicar leva à ficha com o processo aberto                                               |
| `/webhooks`              | Diagnóstico de webhooks, com simulação de entregas (ligue a vista de suporte em Configurações)                |
| `/configuracoes`         | Vista de suporte e restauração dos dados fictícios                                                            |

Para começar, consulte o CNPJ fictício `10.101.010/0001-77` (Aurora Logística
Integrada) ou o processo `1004512-29.2025.8.26.0100`. As consultas
assíncronas e as buscas por OAB, nome ou RJI só existem no app real.

## Rodar

Requisitos: Node.js 20.9 ou superior e pnpm 12 (versão fixada em
`packageManager` no `package.json`). Não há variáveis de ambiente.

```bash
pnpm install
pnpm dev        # http://127.0.0.1:3000
```

| Comando             | Descrição                                               |
| ------------------- | ------------------------------------------------------- |
| `pnpm dev`          | Servidor de desenvolvimento                             |
| `pnpm build`        | Build de produção (todas as páginas estáticas)          |
| `pnpm start`        | Serve o build de produção                               |
| `pnpm lint`         | ESLint (falha com qualquer aviso)                       |
| `pnpm typecheck`    | Gera os tipos de rotas do Next.js e roda `tsc --noEmit` |
| `pnpm test`         | Testes (Vitest), sem rede                               |
| `pnpm format:check` | Verifica a formatação (Prettier)                        |

## Stack

Next.js 16 (App Router, Cache Components), React 19, TypeScript strict,
Tailwind CSS v4, shadcn/ui (Base UI), Zod e Vitest.

## Estrutura

```
src/
  app/(app)/          Rotas: Consultar, Acervo e ficha, Webhooks, Configurações
  components/
    layout/           Cabeçalho, busca global, aviso de alertas na aba
    shared/           Peças comuns (estados vazios, gráfico, paginação, JSON)
    ui/               Componentes shadcn/ui
  features/
    consult/          Página Consultar: reconhecimento do identificador e catálogo de perguntas
    subjects/         Acervo e ficha de cada assunto
    alerts/           Menu do sino e ligação alerta → processo
    trackings/        Monitoramentos (tabela e diálogo de criação)
    webhooks/         Diagnóstico e simulação de entregas
    processes/        Processos (CNJ, tabela, painel lateral)
    parties/          Empresas e pessoas (CPF/CNPJ)
    queries/          Histórico de consultas
    search/           Busca do acervo
    settings/         Configurações, carteira e vista de suporte
  lib/
    mock-data.ts      Os dados fictícios
    data.ts           Leitura dos dados fictícios no servidor
    demo-store.tsx    Estado da aba (monitoramentos criados, alertas lidos, simulações)
    models.ts         Tipos dos dados, os mesmos do app real
```
