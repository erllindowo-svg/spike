# Webhooks

Recebimento (etapa 5) e processamento (etapa 6) das entregas que a JUDIT
envia para a `callback_url` de uma requisição ou de um monitoramento.

## Fluxo

```
servidor ── POST /requests + callback_url=https://<túnel>/api/webhooks/judit?token=… ──▶ JUDIT
JUDIT ── POST JSON (uma entrega por resposta) ──▶ túnel ──▶ src/proxy.ts ──▶ route.ts
route.ts: token → JSON → envelope → grava em webhook_events (pending) → 200
          └─ after(): process.ts → associa → atualiza estado / cria alerta → processed | ignored | failed
```

| Arquivo                               | Responsabilidade                                                              |
| ------------------------------------- | ----------------------------------------------------------------------------- |
| `src/app/api/webhooks/judit/route.ts` | Contrato HTTP: qual status a JUDIT recebe em cada caso                        |
| `callback.ts`                         | Token: leitura, comparação em tempo constante, `callback_url` e mascaramento  |
| `envelope.ts`                         | Valida o envelope e decide o que gravar (redução de dados, token mascarado)   |
| `db.ts`                               | Grava em `webhook_events`; reentrega vira `duplicate: true` pelo índice único |
| `delivery.ts`                         | Lê o que a entrega diz, pelo contrato documentado (600, 700–703, erro)        |
| `process.ts`                          | Regras do app: associa, atualiza consulta/monitoramento, cria alerta          |
| `actions.ts`                          | "Reprocessar" (tela `/webhooks`)                                              |
| `src/proxy.ts`                        | Em desenvolvimento, quem vem pelo túnel só alcança a rota do webhook          |
| `src/app/api/dev/webhooks/route.ts`   | Lista as últimas entregas gravadas (só desenvolvimento, só desta máquina)     |

## Status HTTP e novas tentativas

A JUDIT espera 2xx em menos de 10 s e repete a entrega em 5xx ou timeout
(<https://docs.judit.io/webhook/callbacks>). Um 4xx não é repetido.

| Situação                                      | Status | A JUDIT repete? |
| --------------------------------------------- | ------ | --------------- |
| Webhook desligado (sem token ou modo `demo`)  | 404    | Não             |
| Token ausente ou errado                       | 401    | Não             |
| Corpo não é JSON, ou envelope com tipo errado | 400    | Não             |
| Evento gravado                                | 200    | —               |
| Reentrega (mesmo `callback_id`) já gravada    | 200    | —               |
| Configuração inválida ou banco indisponível   | 503    | Sim             |

## Processamento (etapa 6)

Receber não é processar. O evento é gravado e respondido primeiro; as regras
rodam depois, com `after()` do Next, e uma falha nelas nunca vira 5xx para a
JUDIT (o evento já está salvo).

```
pending ──claim (atômico)──▶ processing ──▶ processed   regra aplicada (nota diz o quê)
                                        ├─▶ ignored     referência desconhecida ou aviso não tratado
                                        └─▶ failed      erro de banco no meio (processingError)
"Reprocessar": pending, failed, ignored e processing parado há mais de 5 min
```

| Entrega                             | Ação no banco                         | Alerta                             |
| ----------------------------------- | ------------------------------------- | ---------------------------------- |
| Processo, monitoramento documento   | —                                     | `new_lawsuit`, um por processo     |
| Processo, monitoramento por CNJ     | —                                     | `lawsuit_movement`, um por entrega |
| Processo, consulta assíncrona       | —                                     | nenhum                             |
| `application_info` 600 (consulta)   | `judit_requests.status = "completed"` | nenhum                             |
| `application_info` 700–703          | monitoramento `status = "paused"`     | `tracking_notice`                  |
| `application_error` (consulta)      | nada: o status não muda (IK7)         | nenhum                             |
| `application_error` (monitoramento) | —                                     | `tracking_notice`                  |
| Referência que o app não conhece    | evento `ignored`                      | nenhum                             |

- **Alerta duplicado:** `alerts.dedupeKey` tem índice único
  (`alerts_dedupe_key_unique`). Reprocessar, reentregar ou receber o mesmo
  processo duas vezes (cache e atualizado) não cria um segundo alerta.
- **Ordem de chegada:** uma entrega pode chegar antes de o app gravar o
  `request_id` (a JUDIT respondeu, mas o `insert` ainda não terminou). Ela
  fica `ignored` e volta a ser processada quando a consulta é gravada.
- **Aviso atrasado:** um 700 que chegue depois de a pessoa reativar o
  monitoramento o marcaria como pausado. "Atualizar status" corrige pela
  JUDIT.
- **Não verificado ao vivo:** entregas de monitoramento (o CNPJ de teste não
  gera nenhuma; catálogo, C14). As regras de monitoramento foram testadas com
  os exemplos da documentação.

## O que é gravado

- **Sempre:** o envelope inteiro (`callback_id`, `event_type`,
  `reference_type`, `reference_id`, `user_id` e campos desconhecidos), em
  `webhook_events.payload`.
- **Respostas de processo** (`response_type` `lawsuit` e outras): o
  `response_data` vira um resumo sem valores, com o `code` (CNJ) e os nomes
  dos campos. O processo continua na JUDIT e pode ser relido pelo
  `response_id`.
- **`application_info` e `application_error`:** gravados inteiros (não têm
  dados de processo).
- **Modo manutenção** (`JUDIT_WEBHOOK_FULL_PAYLOAD=enabled`): grava tudo, para
  diagnóstico. Desligue depois: são dados processuais de terceiros.
- **Nunca:** o token. A JUDIT devolve a `callback_url` em
  `payload.tags.callback_url`, então o token é trocado por `[token]` em
  qualquer texto do corpo antes de gravar, e também nos logs. O
  `src/lib/judit/client.ts` mascara o token em toda resposta da JUDIT (ela
  ecoa a `callback_url` no detalhe da requisição), e o `next.config.ts` tira
  a rota do log de requisições do `next dev`, que imprimiria a URL inteira.

## Segurança

A JUDIT não documenta assinatura (HMAC). A origem é conferida por um token
secreto na `callback_url` (`JUDIT_WEBHOOK_TOKEN`, 32 caracteres ou mais). É
mais fraco que uma assinatura: a URL pode ficar em logs da JUDIT e do túnel.
Em produção, somar a allowlist de IPs da JUDIT, pedida ao suporte. Trocar o
token faz as entregas pendentes de requisições antigas receberem 401.

## Teste real em desenvolvimento

1. `JUDIT_WEBHOOK_TOKEN` no `.env.local` (`openssl rand -hex 32`) e o
   `pnpm dev` reiniciado; `pnpm env:check` deve mostrar 64 caracteres.
2. `cloudflared tunnel --url http://127.0.0.1:3000` (o túnel funciona com o
   `-H 127.0.0.1` porque o `cloudflared` roda nesta máquina). Ele mostra a URL
   `https://….trycloudflare.com`, que muda a cada execução.
3. Uma consulta assíncrona com `callbackOrigin` (gasta crédito):
   `POST /api/dev/judit/requests` com
   `{"searchType":"cnpj","searchKey":"A1B2C3D4/E5F6-68","callbackOrigin":"https://….trycloudflare.com"}`.
4. `GET /api/dev/webhooks` mostra as entregas gravadas; o terminal do
   `pnpm dev` mostra uma linha `[webhooks] recebido: …` por entrega.
5. Desligue o túnel ao terminar: enquanto ele está no ar, a URL é pública.

## Resultado do teste real (2026-10-15)

Consulta assíncrona do CNPJ de teste com `callbackOrigin`: duas entregas
gravadas em 7 s (o processo, do cache, e o código 600), ambas `pending` e
com o token mascarado. Pela URL do túnel, só esta rota respondeu; o resto, 404. Detalhes no diário, entrada "Teste real do webhook".
