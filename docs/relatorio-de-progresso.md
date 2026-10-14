# Relatório de progresso: Raio-X Jurídico

Última atualização: 2026-10-14. Registros detalhados:
[`docs/logs/2026-10-13-sessao.md`](logs/2026-10-13-sessao.md) e
[`docs/logs/2026-10-14-sessao.md`](logs/2026-10-14-sessao.md).

## Onde estamos

| Etapa (AGENTS.md, seção 6)                         | Estado                                                    |
| -------------------------------------------------- | --------------------------------------------------------- |
| 1. Fundação e interface com dados fictícios        | Concluída (tag `prototype-v0.1.0`).                       |
| Client JUDIT (fases 0–3)                           | Concluído, em `main` (PR #1).                             |
| 2. Modelo de dados e persistência                  | Concluída, em `main` (PR #2), testada contra o Atlas.     |
| 3. Primeira consulta real à JUDIT pelo servidor    | **Em andamento:** chamadas reais feitas; fatia 3a pronta. |
| 4 a 7. Monitoramento real, webhooks, idempotência… | Não iniciadas.                                            |

### Estado do Git

- Branch: `feat/judit-datalake`, criada a partir de `main` (`c8e84b8`),
  **não enviada** ao GitHub.
- Commits: a fatia 3a (código e testes) e, separado, a documentação desta
  sessão.

## O que foi feito em 2026-10-14

1. **Primeiras chamadas reais à JUDIT**, só com o CNPJ fictício
   `A1B2C3D4/E5F6-68`, pelas rotas de dev:
   - `POST /lawsuits/count` → `{"total":1,"limited":false}`;
   - `POST /lawsuits` → um processo fictício, CNJ
     `0000000-39.2026.8.26.0050` (TJSP).
2. **Contrato comparado com a documentação**
   (`src/lib/judit/README.md`): confirmadas as contradições 14, 16 e 19;
   novas 32 (`limited`), 33 (campos ausentes e `"NÃO INFORMADO"`) e 34
   (formatos de `classifications`/`side`). Lacuna 10 continua aberta.
3. **CNJ fictício na allowlist** (`src/lib/judit/guard.ts`).
4. **Latência de 2 s explicada** (provável): compilação sob demanda do
   `next dev`, não a JUDIT. Caso C10 no catálogo de falhas.
5. **Desenho da etapa 3 decidido:** híbrido. Processos não vão para o
   MongoDB; só o `request_id` de requests assíncronas (coleção
   `judit_requests`).
6. **Fatia 3a:** botão "Consultar datalake JUDIT" na página da empresa
   (modo `db`).

## Fatia 3a: o que existe

```
Navegador: clique ──► searchCompanyLawsuitsAction   (src/features/processes/actions.ts)
                        modo db? → CNPJ válido? → empresa no MongoDB?
                        └► searchLawsuits ──► guard ──► JUDIT POST /lawsuits
                        └► fromJuditLawsuit         (src/features/processes/judit.ts)
Navegador ◄── lista + request_id + horário (só em memória; F5 limpa)
```

Verificado: 99 testes, lint, typecheck, format e build; página carrega no
modo `db` com o botão. **Clique real verificado em 2026-10-14:** funcionou,
com o CNPJ sem máscara.

## Próxima sessão, em ordem

### 1. Teste manual da 3a (custa 1 requisição)

1. `pnpm env:check`: `DATA_SOURCE="db"` e `JUDIT_LIVE_CALLS="enabled"`.
2. `pnpm dev` e abra `http://localhost:3000/empresas/A1B2C3D4E5F668`.
3. Clique em **"Consultar datalake JUDIT"**. Esperado: 1 processo,
   `0000000-39.2026.8.26.0050`, TJSP, polo passivo, com `request_id` e
   horário acima da tabela.
4. Novidade a observar: o CNPJ vai **sem máscara** (`A1B2C3D4E5F668`). Se
   falhar, leia a linha `[processes] falha ao consultar a JUDIT:` no
   terminal; se for 400 da JUDIT, a hipótese é o formato do CNPJ.

### 2. Opcional e gratuito

Confirmar o caso C10: no terminal do `pnpm dev`, compare `next.js` com
`application-code` na linha da primeira chamada.

### 3. Fatia 3b: consultas assíncronas (concluída; revisada e testada em 2026-10-14)

- Modalidades explícitas: catálogo `src/features/queries/modes.ts`
  (`datalake_sync`, `historical_async`, `historical_on_demand`); o `mode`
  é gravado, não deduzido de `on_demand`.
- Coleção `judit_requests` (índice único em `requestId`), com `mode`,
  `delivery: "polling"` e `cacheTtlInDays` (só na on-demand).
- Card "Consultas assíncronas" na página da empresa (modo `db`): criar
  consulta comum ou on-demand, "Verificar status" manual e leitura das
  respostas quando `completed` (não gravadas).
- Decisões: sem janela de confirmação; `cache_ttl_in_days` opcional na
  on-demand; cofre de credenciais fica para depois.
- **Reinicie o `pnpm dev` antes de testar:** a conexão com o banco fica
  guardada entre recargas, e os índices novos só são criados ao conectar.

### Pendências conhecidas

- No modo `db`, "Abrir processo" leva a `/processos/[cnj]`, que dá 404.
  Caminho natural: `GET /lawsuits/{cnj}` (CNJ já liberado na allowlist).
- Publicar o app com `JUDIT_LIVE_CALLS` ligado exige autenticação e limite
  de taxa: a allowlist limita o que é consultado, não quem nem quantas vezes.
- Reflog do Git (cosmético, de 2026-10-13): duas entradas citam o commit
  perdido `a5ed8b0`.

## Como retomar com o agente

> Li o `docs/relatorio-de-progresso.md`. Fiz o teste manual da 3a e o
> resultado foi: …. Vamos para a 3b.
