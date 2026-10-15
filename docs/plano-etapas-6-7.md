# Plano: etapas 6 e 7 (final da fase 1)

Escrito em 2026-10-15, ao fechar a etapa 5. Serve para retomar o trabalho do
zero, numa conversa nova. Fatos do código têm caminho; o que é proposta ou
hipótese está marcado como tal.

## Atualização de 2026-10-15 (noite): decisões e etapa 6 feita

As seis decisões do fim deste documento foram tomadas, com uma mudança de
escopo proposta pelo usuário:

- **Etapa 6 = back-end completo.** Feita na branch
  `feat/judit-webhook-processing`, um commit por fatia: 6a processamento e
  alertas, 6b telas lendo o banco (sem mudar layout), 6c `callback_url` nas
  consultas assíncronas, 6d correções da consulta assíncrona (itens 8 e 9 da
  revisão). Detalhes no diário, entrada "Etapa 6: processamento, alertas e
  diagnóstico", e em `src/features/webhooks/README.md`.
- **Etapa 7 = produto.** Não é mais "correções pequenas": é usar o app como
  cliente, com tarefas concretas, anotar onde trava, desenhar o fluxo
  desejado antes do código e implementar em fatias. A lista fecha depois do
  uso guiado (proposta abaixo, em "Etapa 7 redefinida").
- Decisão 2: `after()` com reserva atômica (`pending → processing`) e
  "Reprocessar" (aceita `pending`, `failed`, `ignored` e `processing` parado
  há mais de 5 min).
- Decisão 3: a tabela da 6a valeu, com `application_error` numa consulta
  **sem** mudar o status dela (IK7). Achado: as duas entregas reais da etapa
  5 serão `ignored`, porque a rota de dev não grava em `judit_requests`.
- Decisão 4: em vez de "um alerta por monitoramento e CNJ", um `dedupeKey`
  com índice único novo (`alerts_dedupe_key_unique`): por processo no
  monitoramento por documento, por entrega nos demais (no monitoramento por
  CNJ, o CNJ é sempre o mesmo). O índice antigo sem `unique` ficou como está;
  nada a apagar no Atlas.
- Decisão 5: webhook só nas consultas, com `JUDIT_WEBHOOK_PUBLIC_ORIGIN`
  (vazia = polling). Como a pessoa vê o resultado chegar é decisão da
  etapa 7.
- O vocabulário da JUDIT continua na interface (decisão do usuário: mostra
  que as modalidades foram entendidas).

### Etapa 7 redefinida (proposta; a lista fecha depois do uso guiado)

1. Uso guiado: você usa o app com tarefas ("essa empresa tem risco
   jurídico?", "o que mudou desde a semana passada?") e anota onde travou.
2. Fluxo desejado no papel (telas e caminho de cada tarefa), antes do código.
3. Candidatos já conhecidos, para comparar com as anotações:
   - como o resultado de uma consulta com webhook aparece (o card se
     atualiza? aviso? "Verificar status" continua?);
   - aviso do Next em `/empresas` (`<Suspense>`, catálogo D5);
   - `/processos/[cnj]` dá 404 no modo `db` (`GET /lawsuits/{cnj}`);
   - razão social vazia no modo `db` (`POST /entities`);
   - card da consulta assíncrona sem `try/catch` (resto do item 6) e sem
     resumo guardado na tela (resto do item 8);
   - horário da execução em UTC mostrado como local (item 14, IK5);
   - componentes grandes e rótulos montados com `toLowerCase` (itens 15, 16);
   - opcional: conferência de entregas perdidas por `GET /responses` (IK10);
   - monitoramentos com webhook, quando houver um endereço fixo.

### Etapa 8 (proposta do usuário, 2026-10-15): "projeto finalizado"

- **8A. Reprodutibilidade e pontas soltas.** Quem clona o repositório
  consegue rodar sem precisar depurar nada. Proposta de três níveis, cada um
  com instruções próprias: (1) demonstração, sem nada configurado; (2) banco,
  com MongoDB local ou Atlas; (3) JUDIT real, com chave própria, kill switch,
  allowlist e túnel. Critério de pronto: o teste do clone limpo (clonar numa
  pasta nova, seguir só o README, anotar cada travada; cada travada vira um
  item). Primeiro achado: o README da raiz está desatualizado desde a etapa 2
  (diz que alertas e webhooks não são persistidos; a tabela não tem as três
  variáveis do webhook).
- **8B. Auditoria** (`AGENTS.md`, seção 6, "Modo auditoria"), sobre o código
  congelado depois da 8A. O usuário dita o que entendeu; o agente registra no
  diário, marcado como ditado, sem reescrever o sentido.
- **Ordem:** 8A antes da 8B, porque a auditoria não altera código.
- Pendente: a lista da seção 6 do `AGENTS.md` ainda diz "7. Diagnóstico… 8.
  Auditoria". Atualizar é decisão do usuário.

## Onde estamos

As etapas 1 a 5 do `AGENTS.md` (seção 6) estão feitas. A etapa 5 grava cada
entrega da JUDIT em `webhook_events` com `processingStatus: "pending"` e para
aí: nada lê esses eventos ainda. O teste real (2026-10-15) gravou duas
entregas de uma consulta assíncrona do CNPJ de teste: o processo fictício
(do cache) e o fim do fluxo (`application_info`, código 600). Elas continuam
no banco e servem de material para a etapa 6.

Depois da fase 1 vêm a auditoria completa do código (`AGENTS.md`, seção 6,
"Modo auditoria") e a fase 2, o ambiente de treino de suporte, que não deve
ser iniciada antes disso.

## O que já existe para as etapas 6 e 7

| Peça                                                       | Onde                                                                                            | Estado                                                                                            |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Eventos gravados, com status de processamento              | `webhook_events`, `src/features/webhooks/db.ts`                                                 | Pronto (etapa 5)                                                                                  |
| Status de processamento (`pending` … `ignored`)            | `src/db/models.ts`, `WebhookProcessingStatus`                                                   | Definido, só `pending` é usado                                                                    |
| Coleção de alertas e índices                               | `alerts`, `src/db/collections.ts`                                                               | Existe, vazia; índice de `webhookEventId` **não** é único                                         |
| Tipos de alerta do produto                                 | `src/features/alerts/types.ts`                                                                  | `new_lawsuit`, `lawsuit_movement`, `tracking_notice`                                              |
| Consultas do app (para associar `reference_type: request`) | `judit_requests` (`requestId` único, `companyId`, `delivery`)                                   | Pronto (etapa 3); `delivery` já aceita `webhook`                                                  |
| Monitoramentos (para `reference_type: tracking`)           | `trackings` (`juditTrackingId` único, `companyId`)                                              | Pronto (etapa 4)                                                                                  |
| Telas `/webhooks` e `/alertas`                             | `src/features/webhooks/components`, `alerts/components`                                         | Só com dados fictícios; no modo `db` recebem listas vazias (`src/lib/data.ts`, `getInitialState`) |
| Marcar alerta como lido                                    | `src/lib/demo-store.tsx` (`markAlertRead`)                                                      | Só em memória (modo demo)                                                                         |
| Processar depois de responder                              | `after()` do Next (`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/after.md`) | Disponível em route handlers                                                                      |

## Etapa 6: o que falta

```
JUDIT → route.ts: grava (pending) → 200
                └─ after(): processa o evento
                     reference_type "request"  → judit_requests (pelo request_id)  → empresa
                     reference_type "tracking" → trackings (pelo tracking_id)      → empresa
                     → atualiza o estado (consulta concluída, monitoramento pausado)
                     → cria o alerta, se a regra pedir
                     → evento "processed" (ou "ignored" / "failed" + processingError)
Telas: /webhooks (diagnóstico) e /alertas leem o banco
```

### 6a. Processar o evento (tamanho médio)

Proposta de regras. Cada linha é uma decisão sua, não algo da documentação:

| Entrega                                      | Ação no banco                                            | Alerta                                  |
| -------------------------------------------- | -------------------------------------------------------- | --------------------------------------- |
| Processo, de um monitoramento por documento  | evento `processed`                                       | `new_lawsuit` (com o CNJ)               |
| Processo, de um monitoramento por CNJ        | evento `processed`                                       | `lawsuit_movement`                      |
| Processo, de uma consulta assíncrona         | evento `processed`                                       | nenhum (a pessoa pediu; o card mostra)  |
| `application_info` 600 (consulta)            | `judit_requests.status = completed`: substitui o polling | nenhum                                  |
| `application_info` 700 a 703 (monitoramento) | monitoramento `paused`, com o motivo                     | `tracking_notice` ("pausado por saldo") |
| `application_error`                          | evento `processed`; status da consulta a definir (IK7)   | `tracking_notice` se for monitoramento  |
| Referência que o app não conhece             | evento `ignored`                                         | nenhum                                  |

Pontos técnicos:

- **Quando processar:** recomendo `after()` na rota: grava, responde 200 e
  processa em seguida. A resposta continua rápida e o evento nunca se perde,
  porque já foi gravado. Alternativa descartada: processar antes de responder
  (arrisca os 10 s da JUDIT). Filas e workers: só com necessidade demonstrada
  (`AGENTS.md`, seção 7).
- **Reprocessar:** um evento que falhar fica `failed` com `processingError`.
  Uma ação "Reprocessar" na tela de diagnóstico, para `pending` e `failed`.
- **Alerta duplicado:** processar o mesmo evento duas vezes não pode criar dois
  alertas. Proposta: índice único em `alerts.webhookEventId`. Atenção: o
  índice já existe sem `unique`, e o MongoDB recusa um `createIndex` com o
  mesmo nome e opções diferentes. É preciso apagar o índice antigo uma vez no
  Atlas, ou dar outro nome ao novo. Bom caso para o catálogo.
- **Cache e versão atualizada:** um processo pode chegar duas vezes
  (`cached_response: true` e depois `false`). Proposta: um alerta por
  monitoramento e CNJ, e não por entrega. Isso pede `lawsuitCnj` e a
  referência no modelo `Alert`, que o próprio `types.ts` já aponta como
  candidatos.
- **Texto do alerta:** o resumo gravado hoje só tem o CNJ e os nomes dos
  campos. Se o alerta precisar de tribunal ou data de distribuição, decidir se
  o resumo guarda esses campos (não são dados pessoais) ou se o alerta relê o
  processo na JUDIT pelo `response_id`.

### 6b. Telas lendo o banco (tamanho médio)

- `/webhooks`: lista de eventos com status, `callback_id`, referência e erro
  de processamento. Esta tela **é** o painel de diagnóstico da etapa 7:
  "chegou?", "foi processado?", "por que falhou?".
- `/alertas`: alertas do banco; "marcar como lido" grava `readAt` por uma
  server action.
- `getInitialState` (`src/lib/data.ts`) passa a ler eventos e alertas no modo
  `db`.

### 6c. Ligar o produto ao webhook (pequeno ou médio, depende da decisão)

Hoje só a rota de dev envia `callback_url`. Para o produto receber eventos
sozinho:

- **Consultas assíncronas (card da empresa):** enviar `callback_url` e gravar
  `delivery: "webhook"`. Precisa de uma origem pública configurada (proposta:
  uma variável como `JUDIT_WEBHOOK_PUBLIC_ORIGIN`, preenchida com a URL do
  túnel a cada sessão de teste).
- **Monitoramentos:** `POST /tracking` aceita `callback_url`, e
  `updateTrackingCallbackUrl` já existe. Risco em desenvolvimento: a URL do
  túnel muda a cada execução, e um monitoramento criado com uma URL antiga
  entrega para um endereço morto. Os resultados continuam em
  `GET /responses/tracking`, mas os eventos não chegam. Proposta: ligar só as
  consultas em desenvolvimento e deixar monitoramentos para quando houver um
  endereço fixo.

## Etapa 7: escopo fechado proposto

A etapa 7 do `AGENTS.md` ("diagnóstico, tratamento de falhas e refinamento")
não tem fim natural, então ela precisa de uma lista. Proposta:

| Item                                                                         | Origem                        | Tamanho |
| ---------------------------------------------------------------------------- | ----------------------------- | ------- |
| Painel de diagnóstico dos webhooks                                           | já é a 6b                     | —       |
| Não perguntar à JUDIT o status de consulta já concluída; cache na tela       | revisão, item 8; catálogo C16 | pequeno |
| Recusar nova consulta da mesma empresa e modalidade enquanto há uma pendente | revisão, item 9               | pequeno |
| Aviso do Next em `/empresas` (`listLawsuits` fora do `<Suspense>`)           | revisão, item 19; catálogo D5 | pequeno |
| `/processos/[cnj]` dá 404 no modo `db`                                       | pendências do relatório       | pequeno |
| Conferir entregas perdidas por `GET /responses` (opcional)                   | IK10                          | médio   |

O resto da revisão técnica de 2026-10-14 (itens 5, 10, 12 a 18) fica opcional.

## Dá para juntar as etapas 6 e 7?

Sim, e recomendo. Metade da etapa 7 (o diagnóstico de webhooks) já é a tela
da 6b. A outra metade são correções pequenas e independentes, que não
precisam de uma etapa própria. Separar em dois PRs acrescenta trabalho de Git
sem ganho de aprendizado.

O que não deve mudar: o trabalho continua em fatias pequenas e verificáveis
(`AGENTS.md`, seção 6), cada uma com o seu commit e a sua entrada no diário.
Proposta: **uma branch e um PR, quatro fatias, nesta ordem:** 6a → 6b → 6c →
correções da etapa 7.

**Tamanho:** comparável à etapa 5 inteira, talvez um pouco maior. A 6a é a
parte com mais regras novas; a 6b reaproveita as telas do protótipo; as
correções da etapa 7 são pequenas.

## Decisões para o início da próxima sessão

1. Juntar 6 e 7 numa etapa final com quatro fatias? (recomendado: sim)
2. Processar com `after()` e ter a ação "Reprocessar"? (recomendado: sim)
3. As regras da tabela da 6a, linha por linha, principalmente: alerta para
   resultado de consulta (recomendado: não) e o que fazer com
   `application_error` numa consulta (depende do IK7).
4. Um alerta por monitoramento e CNJ, com `lawsuitCnj` no modelo?
   (recomendado: sim)
5. 6c: ligar só as consultas em desenvolvimento? (recomendado: sim)
6. O escopo da etapa 7 na tabela acima.

## Incertezas que afetam o plano

- **Entregas de monitoramento nunca foram observadas.** O monitoramento por
  documento do CNPJ de teste não dispara (catálogo, C14). A 6a vai ser
  testada com os exemplos da documentação (`src/lib/judit/__fixtures__/webhooks.ts`),
  a não ser que o tech lead indique um jeito de disparar um evento (IK6, IK9).
- **A versão "atualizada"** (`cached_response: false`) também nunca chegou: a
  consulta por documento sem `on_demand` não vai ao tribunal.
- **Política de reentrega** (IK10): quantas tentativas e por quanto tempo.
- **Dados reais:** por decisão sua, chamadas reais só com o documento
  fictício. O que só dados reais mostram (volume, campos faltando, processos
  grandes) está no diário, pergunta "Se a recepção funciona com o CNPJ de
  teste, para que usar um CNPJ real?".

## Como retomar numa conversa nova

> Leia `docs/plano-etapas-6-7.md` e `docs/relatorio-de-progresso.md`. Vamos
> decidir os itens de "Decisões para o início da próxima sessão" e começar a
> fatia 6a.
