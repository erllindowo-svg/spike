# Relatório de progresso: Raio-X Jurídico

Última atualização: 2026-10-14 (tarde). Registros detalhados:
[`docs/logs/2026-10-13-sessao.md`](logs/2026-10-13-sessao.md) e
[`docs/logs/2026-10-14-sessao.md`](logs/2026-10-14-sessao.md).

## Onde estamos

| Etapa (AGENTS.md, seção 6)                  | Estado                                                     |
| ------------------------------------------- | ---------------------------------------------------------- |
| 1. Fundação e interface com dados fictícios | Concluída (tag `prototype-v0.1.0`).                        |
| Client JUDIT (fases 0–3)                    | Concluído, em `main` (PR #1).                              |
| 2. Modelo de dados e persistência           | Concluída, em `main` (PR #2), testada contra o Atlas.      |
| 3. Consultas reais à JUDIT pelo servidor    | **Concluída** (fatias 3a e 3b), testada com a JUDIT real.  |
| 4. Monitoramento real                       | Próxima. Monitoramentos ainda só existem no nosso MongoDB. |
| 5 a 7. Webhooks, idempotência, diagnóstico  | Não iniciadas.                                             |

### Estado do Git

- Branch `feat/judit-datalake`, criada a partir de `main` (`c8e84b8`), com
  as fatias 3a e 3b e a documentação. **Não enviada** ao GitHub.
- Próximo passo de Git: enviar a branch, abrir o PR e o usuário faz o merge.

## Etapa 3: o que existe

Modalidades explícitas: cada consulta declara a sua, pelo catálogo
`src/features/queries/modes.ts`. A interface usa o vocabulário da
documentação ("consulta síncrona", "consulta assíncrona", "on-demand"), sem
a palavra "datalake".

| `mode` (interno)       | Endpoint                     | Na tela                           | Gravado no MongoDB?              |
| ---------------------- | ---------------------------- | --------------------------------- | -------------------------------- |
| `datalake_sync`        | `POST /lawsuits`             | "Fazer consulta síncrona"         | Não                              |
| `historical_async`     | `POST /requests`             | card "Consultas assíncronas"      | Só o ponteiro (`judit_requests`) |
| `historical_on_demand` | `POST /requests` + on_demand | mesmo card, com cache_ttl_in_days | Só o ponteiro (`judit_requests`) |

```
Síncrona:   clique → searchCompanyLawsuitsAction → POST /lawsuits → tela
Assíncrona: clique → startAsyncQueryAction → POST /requests → judit_requests
            "Verificar status" → checkAsyncQueryAction → GET /requests/{id}
            quando completed → GET /responses → tela (não gravado)
```

Fatos confirmados nesta etapa:

- A JUDIT aceita o CNPJ **sem máscara** em `POST /lawsuits` e em
  `POST /requests`.
- Uma request assíncrona concluída **atualiza o datalake** da JUDIT, no
  mesmo fluxo da entrega (tech lead da JUDIT; README, item 35). Por isso os
  processos não são copiados para o nosso banco.

Verificado: 111 testes, lint, typecheck, format e build; testes manuais das
duas fatias com o CNPJ fictício.

## Pendências conhecidas

- No modo `db`, "Abrir processo" leva a `/processos/[cnj]`, que dá 404.
  Caminho natural: `GET /lawsuits/{cnj}` (CNJ fictício já na allowlist).
- Razão social vazia no modo `db`: viria de `POST /entities` (`getEntity`
  já existe no client; nenhuma tela usa).
- Cofre de credenciais (`customer_key`, processos em segredo de justiça):
  adiado por decisão do usuário.
- Publicar o app com `JUDIT_LIVE_CALLS` ligado exige autenticação e limite
  de taxa: a allowlist limita o que é consultado, não quem nem quantas vezes.
- Caso C10 (os 2 s da primeira chamada): confirmação final opcional pelas
  linhas `next.js` × `application-code` do terminal.
- Reflog do Git (cosmético, de 2026-10-13): duas entradas citam o commit
  perdido `a5ed8b0`.

## Próxima sessão, em ordem

1. **Merge da etapa 3:** enviar `feat/judit-datalake`, abrir o PR, merge
   pelo usuário, depois `git switch main && git pull`.
2. **Etapa 4: monitoramento real.** Antes de implementar, discutir o desenho:
   `POST /tracking` gera execuções **recorrentes e cobradas** enquanto
   ativo; modalidades explícitas também aqui (por documento × por CNJ);
   como pausar e excluir; e como o resultado chega (polling agora, webhook
   na etapa 5).

## Como retomar com o agente

> Li o `docs/relatorio-de-progresso.md`. O PR da etapa 3 foi (ou não foi)
> mergeado. Vamos discutir o desenho da etapa 4.
