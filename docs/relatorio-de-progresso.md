# Relatório de progresso: Raio-X Jurídico

Última atualização: 2026-10-15, noite (etapa 6 implementada; etapa 7 redefinida como etapa de produto). Registros detalhados:
[`docs/logs/2026-10-13-sessao.md`](logs/2026-10-13-sessao.md) e
[`docs/logs/2026-10-14-sessao.md`](logs/2026-10-14-sessao.md).

## Onde estamos

| Etapa (AGENTS.md, seção 6)                  | Estado                                                                   |
| ------------------------------------------- | ------------------------------------------------------------------------ |
| 1. Fundação e interface com dados fictícios | Concluída (tag `prototype-v0.1.0`).                                      |
| Client JUDIT (fases 0–3)                    | Concluído, em `main` (PR #1).                                            |
| 2. Modelo de dados e persistência           | Concluída, em `main` (PR #2), testada contra o Atlas.                    |
| 3. Consultas reais à JUDIT pelo servidor    | **Concluída** (fatias 3a e 3b), testada com a JUDIT real.                |
| 4. Monitoramento real                       | **Concluída** em 2026-10-15: primeira execução conferida, teste pausado. |
| 5. Receber e gravar um webhook              | **Concluída** em 2026-10-15, em `main` (PR #5).                          |
| 6. Processamento, alertas e diagnóstico     | **Implementada** em 2026-10-15; falta o teste manual (ver abaixo).       |
| 7. Produto: fluxos e experiência            | Redefinida em 2026-10-15 (`docs/plano-etapas-6-7.md`). Não iniciada.     |
| 8. Auditoria completa do código             | No fim do projeto (`AGENTS.md`, seção 6, "Modo auditoria").              |

### Estado do Git

- Etapa 3 mergeada na `main` (PR #3, `10760a5`).
- Etapa 4 na branch `feat/judit-tracking` (a partir de `10760a5`): código
  e documentação da etapa, depois três commits das pontas soltas (servidor
  de dev, correções e documentação). **Não enviada** ao GitHub.
- 2026-10-15: diário com seção única de explicação (`918c257`, branch
  `docs/diario-secao-unica`) e registro do fechamento da etapa 4, ambos
  levados para a `feat/judit-tracking`, que foi enviada com o PR da etapa 4.
  PR #4 mergeado em 2026-10-15 (`main` em `2881807`).
- Etapa 5 mergeada na `main` (PR #5, `2785610`).
- Etapa 6 na branch `feat/judit-webhook-processing` (a partir de
  `2785610`): um commit por fatia (6a a 6d) e um de documentação. **Não
  enviada** ao GitHub.

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

## Etapa 4: monitoramento real (implementada em 2026-10-14)

Decisões (delegadas ao agente pelo usuário):

- **Modalidade explícita:** `mode` gravado em cada monitoramento
  (`tracking_document`, `tracking_lawsuit`), no mesmo catálogo das consultas.
- **Reserva antes da chamada cobrada:** o monitoramento é gravado como
  `creation: "pending"` (o índice único barra duplicatas) e só então vai para
  `POST /tracking`. Duplicata na JUDIT custaria em dobro a cada recorrência.
- **Resultado do envio:** `confirmed` (criado), `failed` (4xx: nada criado, o
  CNPJ fica livre), `uncertain` (timeout, rede, 5xx: pode existir, o CNPJ
  continua bloqueado) ou volta a `pending` (chamadas desligadas ou allowlist:
  nada saiu do servidor).
- **Registro da etapa 2:** lido como reserva pendente; pode ser enviado ou
  descartado. Recomendação: descartar (a recorrência antiga pode ser diária)
  e criar um novo, com 30 dias.
- **Sincronização manual:** "Atualizar status", "Ver resultados", "Pausar" e
  "Reativar" no menu do monitoramento; "Excluir" pede confirmação (é
  definitivo). Recorrência padrão no diálogo: 30 dias.
- Monitoramento por CNJ usa o mesmo fluxo, mas **não será testado** até a
  JUDIT confirmar se o CNJ fictício serve.

```
"Criar na JUDIT" → createTrackingAction
  1. createTracking: reserva no MongoDB (creation: pending; índice único)
  2. claimReservation: pending → sending (atômico: um clique só envia)
  3. POST /tracking → log do tracking_id → confirmReservation
     (ou failReservation / markReservationUncertain / releaseReservation)
Menu → refresh/pause/resume/delete/results: só para IDs confirmados do app
```

### Teste manual (atravessa duas sessões)

1. `pnpm env:check`: `DATA_SOURCE="db"` e `JUDIT_LIVE_CALLS="enabled"`.
2. Em `/monitoramentos`, o registro antigo do CNPJ fictício aparece como
   "Não enviado à JUDIT": **Descartar reserva**.
3. "Novo monitoramento" → CNPJ `A1B2C3D4/E5F6-68`, recorrência 30 dias →
   "Criar na JUDIT". Esperado: "Criado na JUDIT", com a hora da primeira
   execução. Novidade: CNPJ sem máscara em `POST /tracking`.
4. Menu → "Atualizar status": esperado `created`.
5. **Até 24 h depois:** "Atualizar status" (esperado `updated`), "Ver
   resultados" (esperado o processo fictício) e então **"Pausar na JUDIT"**.

**Resultado (2026-10-15):** a execução rodou às 06:55 UTC e terminou
`completed` com **zero** respostas. A expectativa "o processo fictício"
estava errada: o monitoramento por documento só avisa processos distribuídos
depois da criação (a JUDIT grava `distribution_date_gte`; README, item 37;
catálogo, C14). Pausado pelo usuário às 21:58 UTC; JUDIT e MongoDB com
`paused`. Detalhes no diário, entrada "Primeira execução do monitoramento e
pausa".

## Etapa 5: receber e gravar webhooks (implementada em 2026-10-15)

Decisões do usuário: túnel `cloudflared`; token secreto na `callback_url`
(a JUDIT não documenta assinatura); consulta assíncrona com `callback_url`
como gatilho do teste; gravar o envelope completo e resumir o dado de
processo, com um modo manutenção que grava tudo.

```
POST /api/dev/judit/requests {callbackOrigin} → createRequest(callback_url=…?token=…) → JUDIT
JUDIT → túnel → src/proxy.ts (só /api/webhooks/judit passa) → route.ts
route.ts: token (401) → JSON (400) → envelope (400) → webhook_events (503 se falhar) → 200
```

- Detalhes, tabela de status e teste real: `src/features/webhooks/README.md`.
- Variáveis novas: `JUDIT_WEBHOOK_TOKEN` (vazia = webhook desligado) e
  `JUDIT_WEBHOOK_FULL_PAYLOAD` (modo manutenção).
- `src/proxy.ts`: em desenvolvimento, quem não vem desta máquina só alcança a
  rota do webhook. Testado no `pnpm dev` com cabeçalhos simulados.
- 180 testes, lint, typecheck, formatação e build passando.
- **Teste real (2026-10-15):** uma consulta assíncrona do CNPJ de teste com
  `callbackOrigin` gerou duas entregas em 7 s (o processo, do cache, e o
  código 600), gravadas com o token mascarado. Pela URL do túnel, só a rota
  do webhook respondeu. Túnel encerrado. Falta: commit, push e PR.
- Casos do catálogo: D6 e F1 a F6.

## Etapa 6: processamento, alertas e diagnóstico (implementada em 2026-10-15)

```
JUDIT → route.ts: grava (pending) → 200
                └─ after(): process.ts
                     request  → judit_requests (600 → completed)
                     tracking → trackings (700–703 → paused) + alerta (dedupeKey único)
                     → processed | ignored | failed (+ nota ou erro)
/webhooks e /alertas leem o banco; "Reprocessar" e "marcar como lido" por server action
Card da empresa: callback_url quando JUDIT_WEBHOOK_PUBLIC_ORIGIN está preenchida
```

- Regras e tabela: `src/features/webhooks/README.md`. Catálogo: G1 a G6.
  Pergunta nova: IK11 (entregas de monitoramento). README: item 42.
- 219 testes, lint, typecheck, formatação e build. Fumaça: `/webhooks` e
  `/alertas` respondem 200 lendo o Atlas.
- Itens 8 e 9 da revisão corrigidos (6d).

### Teste manual da etapa 6 (você)

1. **Reinicie o `pnpm dev`.** Sem isso, o índice único de alertas não é
   criado no Atlas (catálogo, G4). Depois, confira em Atlas → `alerts` →
   Indexes: `alerts_dedupe_key_unique`.
2. `/webhooks`: abra as duas entregas da etapa 5 e clique em
   "Reprocessar". Esperado: "Ignorado", com a nota "Consulta não encontrada
   nesta aplicação" (G1). Clique de novo: deve reprocessar e dar o mesmo
   resultado.
3. Teste de ponta a ponta (gasta uma consulta do CNPJ fictício): ligue o
   túnel (`cloudflared tunnel --url http://127.0.0.1:3000`), ponha a URL em
   `JUDIT_WEBHOOK_PUBLIC_ORIGIN` no `.env.local`, confira com
   `pnpm env:check` e crie uma consulta assíncrona no card da empresa.
   Esperado: duas entregas em segundos, a de código 600 `processed` com
   "Consulta marcada como concluída", e o card mostrando "Concluída" depois
   de recarregar a página, sem clicar em "Verificar status". No terminal,
   `[webhooks] processed: …`. Esvazie a variável e desligue o túnel ao fim.
4. Uma segunda consulta igual, logo em seguida, só é aceita se a primeira
   estiver concluída no banco (G5).

## Revisão técnica de 2026-10-14: o que corrigir nas próximas sessões

Revisão do trabalho do dia (fatias 3b e 4). Corrigidos em 2026-10-14
(noite): itens 1, 2, 3, 4, 6, 7, 11 e parte do 17, todos da etapa 4. O
que continua aberto está no fim desta seção.
Ordem sugerida: primeiro os itens de prioridade alta, antes de ampliar o
produto.

### Prioridade alta

1. **Corrigido em 2026-10-14 (noite):** o script `dev` agora é
   `next dev -H 127.0.0.1`. Verificado com `ss -ltn` (`LISTEN 127.0.0.1:3000`), um
   `curl` local (200) e um `curl` pelo IP da rede (conexão recusada).
   Problema original: **servidor de dev exposto na rede local.** O `next dev` escuta em
   `0.0.0.0` por padrão (o log mostrou `Network: http://192.168.15.188:3000`).
   Com `JUDIT_LIVE_CALLS` ligado e sem autenticação, qualquer pessoa na mesma
   rede pode chamar as server actions: criar consultas cobradas (só do CNPJ
   fictício, por causa da allowlist) e pausar ou excluir os monitoramentos do
   app. Correção barata: `next dev -H 127.0.0.1` no script `dev`
   (`node_modules/next/dist/docs/01-app/03-api-reference/06-cli/next.md`).
2. **Corrigido em 2026-10-14 (noite).** No modo `db`, a lista de monitoramentos vem direto do
   `initialState` do servidor; `replaceTracking`/`removeTracking` saíram.
   Problema original: **estado duplicado dos monitoramentos no modo `db`.** O
   `DemoStoreProvider` guarda os monitoramentos num `useReducer` iniciado uma
   única vez. O `refresh()` das actions rerenderiza o layout e relê o MongoDB,
   mas o reducer descarta o novo `initialState`. Hoje compensamos com
   `replaceTracking`/`removeTracking`. Consequências: cada action relê todos
   os monitoramentos e empresas à toa, e mudanças feitas por outro caminho
   (outra aba, futuros webhooks) só aparecem com a página recarregada. O nome
   "DemoStore" para dados reais também confunde. Correção: no modo `db`, ler
   os monitoramentos do servidor e confiar no `refresh()`, ou sincronizar o
   estado quando o `initialState` mudar.
3. **Corrigido em 2026-10-14 (noite).** A busca sai do clique (`useTrackingResults`). Problema
   original: **"Ver resultados" chama a JUDIT duas vezes em desenvolvimento.**
   `TrackingResults` busca os dados num `useEffect`. Com o Strict Mode (ligado
   por padrão no App Router), o efeito roda duas vezes: dois
   `GET /responses/tracking`, possivelmente cobrados. Correção: buscar no
   clique (handler do menu), não no efeito.
4. **Corrigido em 2026-10-14 (noite).** Ação "Conferir na JUDIT" (`reconcileTrackingAction`);
   ver o caso C12 do catálogo. Problema original: **`uncertain` bloqueia o
   identificador para sempre.** Não há ação de
   conferência; um registro parado em `sending` (servidor caiu no meio do
   envio) também. Correção: ação "Conferir na JUDIT" que procura o
   monitoramento em `GET /tracking` (filtro por `search_key`, formato a
   confirmar) e confirma ou libera a reserva.

### Prioridade média

5. **O índice de unicidade ignora a modalidade.** A chave é
   `{ searchType, searchKey }`, e `trackingModeFor` supõe uma modalidade por
   tipo de identificador. Isso contradiz a justificativa do campo `mode`: um
   monitoramento por documento e um do Diário Oficial para o mesmo CNPJ
   seriam barrados como duplicata. Correção, quando a segunda modalidade por
   CNPJ entrar: incluir `mode` na chave (exige remover e recriar o índice).
6. **Corrigido em 2026-10-14 (noite).** `try/catch` em todos os handlers de monitoramento, com
   a mensagem `SERVER_UNREACHABLE`. A consulta assíncrona (etapa 3) continua
   sem. Problema original: **falha de transporte nas server actions não é
   tratada no cliente.** Se a
   chamada à action falhar (servidor reiniciando, rede), a promessa rejeita:
   no React 19, o erro dentro de `startTransition` vai para a tela de erro da
   rota; o `toast.loading` do menu fica preso; o painel de resultados fica com
   o "Consultando a JUDIT…" para sempre. Correção: `try/catch` nos handlers,
   com toast de erro.
7. **Corrigido em 2026-10-14 (noite).** A mensagem de criação avisa (`recurrenceWarning`).
   Problema original: **divergência de recorrência silenciosa.** Pedimos 30 dias e a JUDIT
   gravou 1 (caso C11); a tela só mostra "Diária". Correção: comparar o
   pedido com o devolvido e avisar na mensagem de criação. Rever as opções do
   diálogo (7, 15, 30) depois da resposta do tech lead.
8. **Chamadas repetidas na consulta assíncrona.** `checkAsyncQueryAction`
   pergunta o status à JUDIT mesmo quando o banco já diz `completed`, e cada
   "Ver resultado" relê as respostas. Correção: pular o `GET /requests` quando
   já concluída e guardar o resumo em memória na tela.
9. **Clique duplo na consulta assíncrona.** O monitoramento tem reserva
   atômica; `startAsyncQueryAction` depende só do botão desabilitado. Dois
   POST rápidos (ou um POST direto) criam duas consultas cobradas. Foi uma
   escolha consciente (custo único), mas vale uma regra simples: recusar nova
   consulta da mesma empresa e modalidade enquanto houver uma `pending` ou
   `started`.
10. **`src/features/queries` virou um módulo compartilhado sem esse nome.**
    Guarda o catálogo de modalidades (inclusive as de monitoramento), a
    tradução de erros (`failure.ts`) e o resumo de respostas
    (`responses.ts`), usados por processos e monitoramentos. E
    `src/lib/mock-data.ts`/`demo-store.tsx` importam de `features` (camada
    `lib` dependendo de `features`). Correção: mover para um módulo próprio,
    por exemplo `src/features/judit/`.
11. **Corrigido em 2026-10-14 (noite).** As funções do banco viraram `reserveTracking` e
    `getStoredTracking`. Problema original: **nomes iguais em camadas
    diferentes.** `createTracking` e `getTracking`
    existem em `src/lib/judit/tracking.ts` (JUDIT) e em
    `src/features/trackings/db.ts` (banco); as actions precisam de aliases.
    Correção: renomear os do banco (`reserveTracking`, `getStoredTracking`),
    deixando a regra da reserva visível no nome.

### Prioridade baixa e observações

12. O layout carrega todos os monitoramentos e empresas em toda navegação,
    sem paginação; e `checkAsyncQueryAction`/`trackingResultsAction` buscam a
    empresa pelo CNPJ, quando o registro já tem `companyId` e `searchKey`.
13. Só a primeira página de respostas é lida (`page_size` 100 ou 50). A tela
    mostra "X de Y carregadas", mas não busca o resto.
14. **Em parte verificado em 2026-10-15:** `GET /responses/tracking` aceita
    `AAAA-MM-DDT00:00:00`; o `hour_range` parece estar em UTC (06:55 UTC com
    `hour_range: 6`; IK5), então a tela "às 6h" engana quem está em Brasília.
    Falta: o `response_type` e os campos das respostas de monitoramento (a
    execução não teve resultados).
15. Componentes grandes: `company-detail.tsx` (328 linhas),
    `new-tracking-dialog.tsx` (333) e `demo-store.tsx` (575). Extrair o card
    da consulta síncrona, como foi feito com o das assíncronas.
16. Frases montadas com `label.toLowerCase()` ("Fazer consulta síncrona")
    quebram se o rótulo mudar.
17. **Em parte corrigido em 2026-10-14 (noite):** testes de
    `refreshTrackingAction`, `resumeTrackingAction`, 201 inesperado →
    `uncertain` e aviso de recorrência; a mensagem de timeout ficou genérica.
    Continuam faltando: resultados por CNJ e testes de interface. Texto
    original: testes que faltam: `refreshTrackingAction` e `resumeTrackingAction`;
    `JuditUnexpectedResponseError` → `uncertain`; resultados de
    monitoramento por CNJ (sem empresa); e nenhum teste de interface. A
    mensagem de timeout em `failure.ts` diz "a consulta pode ter sido
    cobrada" também ao pausar ou excluir.
18. Processo: o diário passou de 1.400 linhas. Um índice por etapa no topo
    ajudaria a estudar.
19. **Observado em 2026-10-15:** aviso do Next.js em `/empresas`
    ("uncached data during prerendering or a navigation"): a página espera
    `listLawsuits()` fora do próprio `<Suspense>` (catálogo, D5). O item 8
    também foi observado ao vivo (catálogo, C16).

### O que continua aberto, e por quê

- **5 (índice sem a modalidade):** só faz diferença quando entrar uma
  segunda modalidade para o mesmo CNPJ. Mudar o índice agora exigiria
  removê-lo e recriá-lo no Atlas sem necessidade.
- **14 (formato de data e fuso):** depende da primeira execução real, amanhã.
- **8, 9 e 16:** são da consulta assíncrona e da página da empresa (etapa
  3), não do monitoramento.
- **10 (mover `src/features/queries`):** refatoração de várias pastas; melhor
  fazer à parte, num commit só de movimentação.
- **12, 13, 15 e 18:** baixa prioridade.

## Pendências conhecidas

- No modo `db`, "Abrir processo" leva a `/processos/[cnj]`, que dá 404.
  Caminho natural: `GET /lawsuits/{cnj}` (CNJ fictício já na allowlist).
- Razão social vazia no modo `db`: viria de `POST /entities` (`getEntity`
  já existe no client; nenhuma tela usa).
- "Conferir na JUDIT" (envio incerto) só foi testada com `fetch` simulado.
  Os filtros de `GET /tracking` não são usados; a comparação é feita no
  nosso código (caso C12).
- Perguntas sobre o funcionamento interno da JUDIT: ficam no diário, seção
  "Inside knowledge", e você as responde lá.
- Cofre de credenciais (`customer_key`, processos em segredo de justiça):
  adiado por decisão do usuário.
- Publicar o app com `JUDIT_LIVE_CALLS` ligado exige autenticação e limite
  de taxa: a allowlist limita o que é consultado, não quem nem quantas vezes.
- Reflog do Git (cosmético, de 2026-10-13): duas entradas citam o commit
  perdido `a5ed8b0`.

## Próxima sessão, em ordem

1. Teste manual da etapa 6 (seção acima), depois push e PR da
   `feat/judit-webhook-processing` (você).
2. **Etapa 7 (produto):** começar pelo uso guiado. Plano em
   [`docs/plano-etapas-6-7.md`](plano-etapas-6-7.md), seção "Etapa 7
   redefinida".
3. **Auditoria completa do código**, no modo descrito no `AGENTS.md`.

## Como retomar com o agente

> Leia `docs/relatorio-de-progresso.md` e a seção "Etapa 7 redefinida" de
> `docs/plano-etapas-6-7.md`. Vamos começar a etapa 7 pelo uso guiado.
