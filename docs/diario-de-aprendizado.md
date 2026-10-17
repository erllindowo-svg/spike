# Diário de aprendizagem — Raio-X

## Como usar

Depois de cada fatia importante:

1. Peça ao Claude um resumo técnico objetivo do que mudou e do fluxo de dados.
2. Quando quiser, escreva na seção única **Minha explicação do projeto, em palavras próprias**, logo abaixo, sem copiar a explicação do agente. Ela cobre o projeto inteiro e só você escreve nela; as entradas não têm mais uma seção de explicação própria.
3. Tente responder às perguntas de verificação antes de pedir as respostas.
4. Registre qualquer dúvida que ainda não saiba resolver sem ajuda.
5. Se algo falhou (ou poderia falhar), registre o caso no **Catálogo de investigação de falhas**, logo abaixo.
6. Dúvidas sobre o funcionamento interno da JUDIT vão para **Inside knowledge**, depois do catálogo; você as responde lá.

Não é necessário registrar alterações triviais de CSS, nomes ou formatação.

---

## Minha explicação do projeto, em palavras próprias

protótipo: achei de boa etiqueta de git deixar o protótipo com mock data e etc com uma tag no github nesse primeiro commit, aí o projeto vai evoluindo e perdendo funcionalidades ao tentar construí-las de fato, mas sempre tem um norte no "protótipo finalizado".
implementação da api key: tenho bastante insegurança com lidar com dados que devem ser protegidos então tomei as precauções corretas e li o que deveria ser feito/boas práticas de segurança

---

## Catálogo de investigação de falhas

Este é o material de suporte técnico do projeto: cada falha que aconteceu (ou que o código já prevê) com o sintoma, o sinal que separa uma hipótese da outra, a causa e a prevenção. Atualize a cada caso novo, usando o modelo no fim da seção.

**Status de cada caso**

- **Observado:** aconteceu neste projeto, com data.
- **Previsto:** o código trata e os testes simulam, mas nunca foi visto com o serviço real.
- **Documentado:** vem da documentação da JUDIT e ainda não foi confirmado numa chamada real.

### Método (AGENTS.md, seção 10)

1. Reproduzir, ou explicar por que não é possível.
2. Ler o sinal: mensagem, status HTTP, nome do erro, log do servidor. Sem segredos.
3. Localizar a camada em que parou (mapa abaixo).
4. Formular a hipótese mais provável e um teste pequeno que a confirme ou refute.
5. Fazer a menor correção na causa e rodar uma regressão.
6. Registrar o caso aqui.

### Mapa das camadas

```
 NAVEGADOR            SERVIDOR NEXT (sua máquina / Vercel)                 SERVIÇOS EXTERNOS
 ─────────            ─────────────────────────────────────                ─────────────────
 formulário ──POST──► Server Action / rota /api/dev/judit/...
                        │
                        ├─ 1. ambiente: .env.local → loadEnvConfig → process.env
                        │       └─ src/lib/env.ts valida (getServerEnv)
                        │
                        ├─ 2. banco: src/db/index.ts (getDb) ──TLS──────────► MongoDB Atlas
                        │       └─ ensureIndexes na 1ª conexão                (Network Access,
                        │                                                      Database Access)
                        └─ 3. JUDIT: guard.ts (kill switch, allowlist)
                                └─ client.ts (juditRequest) ──HTTPS─────────► lawsuits / requests /
                                     header api-key, timeout 15 s               tracking .production.judit.io
 Ferramentas de diagnóstico: pnpm env:check [--db] · log do terminal do pnpm dev · Atlas Data Explorer
```

**Primeira pergunta de triagem: em que camada parou?**

| Sinal                                                                | Camada provável                                          |
| -------------------------------------------------------------------- | -------------------------------------------------------- |
| Página com selo "Dados de demonstração" quando devia ser "Banco"     | 1. ambiente                                              |
| "Variável de ambiente … ausente ou inválida"                         | 1. ambiente                                              |
| Espera longa e depois erro (≈30 s no app, ≈10 s no `env:check --db`) | 2. rede até o Atlas                                      |
| `bad auth` / `authentication failed`                                 | 2. credenciais do banco (a rede funcionou)               |
| Rota `/api/dev/judit/...` responde 404                               | 3. rotas de dev desligadas (ambiente), não "rota errada" |
| Rota de dev responde 4xx/5xx com `error.kind`                        | 3. JUDIT: ver a tabela da seção C                        |
| Comando do agente "denied"                                           | Permissões do Claude Code, não o código                  |

### A. Ambiente: a ponte entre o código e a infraestrutura

**A1. App continua em "Dados de demonstração" com o Atlas configurado.** _Observado em 2026-10-13._

- Sinal: selo de demonstração no cabeçalho; HTTP 200 na página (o 200 não prova nada, o modo demo também responde 200).
- Hipóteses: `DATA_SOURCE` ausente ou com nome errado; servidor com ambiente antigo.
- Teste que separou: perguntar ao carregador do Next o que ele leu (hoje: `pnpm env:check`). Mostrou `MONGO_URI`, `MONGO_DB_NAME` e `DATA_SOURCE=mongodb` em vez de `MONGODB_URI`, `MONGODB_DB` e `DATA_SOURCE=db`.
- Causa raiz: o `.env.example` ainda descrevia o PostgreSQL; a ponte entre código e ambiente estava quebrada, e o agente não podia lê-la.
- Prevenção: `src/lib/env.test.ts` (o `.env.example` precisa ter exatamente as variáveis de `env.ts`) e o aviso de "nomes que o código não usa" no `env:check`.
- Lição de suporte: pergunte ao programa o que ele leu, não ao arquivo o que ele contém.

**A2. `DATA_SOURCE=mongodb` caiu em demo em vez de dar erro.** _Observado em 2026-10-13; causa não confirmada._

- Esperado pelo código: `getServerEnv("DATA_SOURCE")` lança "Variável de ambiente DATA_SOURCE ausente ou inválida".
- Hipótese: o `pnpm dev` (com Cache Components) serviu uma renderização feita antes da troca do `.env.local`; o log mostrava `Reload env: .env.local`.
- Teste proposto: com o servidor parado, colocar um valor inválido, subir `pnpm dev` do zero e abrir a página. Se der erro, a hipótese se confirma. Lição provável: depois de mudar o `.env.local`, reinicie o servidor antes de concluir qualquer coisa.

**A3. `.env.example` com valor real ou desatualizado.** _Previsto (prevenção criada em 2026-10-14)._

- Sinal: `pnpm test` falha em `src/lib/env.test.ts`, mostrando só nomes de variáveis.
- Correção: deixar o valor vazio e copiar a linha para o `.env.local`. Se o valor chegou a um commit enviado, trocar a credencial no serviço.

**A4. Valor do `.env` cortado no `#`.** _Observado com dado falso em 2026-10-14._

- Sinal: o `env:check` mostra um tamanho menor que o esperado, ou "a URI não tem usuário e senha".
- Causa: num valor sem aspas, o carregador trata o `#` como início de comentário.
- Correção: senhas só com letras e números, ou o valor entre aspas.

### B. MongoDB Atlas

**B1. `bad auth : authentication failed`.** _Observado em 2026-10-14, duas causas seguidas._

- O que o sinal prova: a conexão chegou ao Atlas (rede e IP ok); a falha é de usuário ou senha.
- Causa 1: a senha ficou entre `<` e `>`, sobra do marcador `<db_password>` do Atlas.
- Causa 2: depois disso, a senha ainda não era a do usuário do banco (Database Access), e sim outra.
- Teste que separou: `pnpm env:check` mostra usuário, caminho, opções e avisos da URI sem exibir a senha. Quando tudo isso está certo e o erro continua, só sobra a senha.
- Correção: Atlas > Database Access > Edit Password > Autogenerate; colar entre `usuario:` e `@`; salvar o arquivo.
- Dica: o tamanho da URI mudar (102 → 100 → 106) é um indício de que o arquivo foi de fato salvo.

**B2. Espera longa e depois `MongoServerSelectionError`.** _Previsto._

- Hipóteses: IP não liberado em Network Access; sem internet; cluster pausado.
- Teste: `pnpm env:check --db` (desiste em 10 s, contra 30 s do driver no app).

**B3. `MongoParseError`.** _Previsto._ URI malformada, quase sempre por caractere especial na senha sem codificação (`@ : / ? #`).

**B4. "Já existe um monitoramento ativo para este identificador."** _Observado em 2026-10-14; é comportamento correto, não falha._

- Quem decide: o índice único parcial `trackings_active_search_key_unique` (`{searchType, searchKey}` com `active: true`). O driver devolve E11000, e `isDuplicateKeyError` traduz para `reason: "duplicate"`.
- Falha de verdade seria o oposto: um duplicado gravado. Nesse caso, conferir a aba Indexes da coleção `trackings`.

**B5. "Não foi possível salvar no banco. Tente novamente em instantes."** _Previsto._ A mensagem do driver fica só no log do servidor: procurar `[trackings] falha ao gravar monitoramento:` no terminal do `pnpm dev`.

**B6. Coleções não aparecem no Atlas.** _Previsto._ O app nunca conectou: modo `demo` ou nenhuma página leu o banco. Na primeira conexão, `ensureIndexes` cria as quatro coleções, mesmo vazias.

### C. Chamadas à JUDIT pelo client padronizado

A primeira chamada real foi feita em 2026-10-14 (`POST /lawsuits/count`, sucesso); os casos de falha abaixo continuam como **Previsto** ou **Documentado** até acontecerem. Toda chamada passa por `juditRequest` (`src/lib/judit/client.ts`), e cada falha vira uma classe de `src/lib/judit/errors.ts`. As rotas `/api/dev/judit/...` traduzem a classe num status HTTP **da nossa rota** (`src/lib/judit/dev-route.ts`): 502 e 504 querem dizer "a JUDIT falhou", não "a rota está quebrada".

As verificações acontecem nesta ordem; a primeira que falha encerra a chamada:

| #   | Onde falha                   | Classe (`kind`)                                        | Rota dev | Primeira hipótese e próximo passo                                                                                                                                                                           |
| --- | ---------------------------- | ------------------------------------------------------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | Rota desligada               | —                                                      | 404      | `NODE_ENV` não é `development` (usou `pnpm start`?) ou `JUDIT_LIVE_CALLS` não é exatamente `enabled`. Conferir com `pnpm env:check`.                                                                        |
| 1   | Entrada da nossa rota        | — (`invalid_input`)                                    | 400      | Corpo não é JSON ou campo fora do schema da rota; `issues` diz qual.                                                                                                                                        |
| 2   | Kill switch                  | `JuditLiveCallsDisabledError` (`live_calls_disabled`)  | 503      | Raro pela rota, que já responde 404 antes. Em código chamado por outro caminho, significa `JUDIT_LIVE_CALLS` desligado.                                                                                     |
| 3   | Allowlist                    | `JuditGuardError` (`guard`)                            | 403      | Documento fora de `ALLOWLIST` em `guard.ts`. A mensagem não repete a chave, de propósito (pode ser documento de pessoa real).                                                                               |
| 4   | Rede                         | `JuditNetworkError` (`network`)                        | 502      | DNS, TLS, sem internet. Ver `cause`. Não houve resposta HTTP.                                                                                                                                               |
| 5   | Tempo limite                 | `JuditTimeoutError` (`timeout`)                        | 504      | 15 s (180 s com `on_demand`). **Num POST, a JUDIT pode ter processado e cobrado mesmo assim.** Não repetir às cegas: conferir antes o histórico (`GET /requests`).                                          |
| 6   | HTTP 4xx/5xx                 | `JuditHttpError` (`http`)                              | 502      | Ler `upstreamStatus`, `errorName` e `bodySnippet`. 401: chave inválida **ou** limite de uso excedido (documentado). 5xx: problema do lado da JUDIT.                                                         |
| 7   | HTTP 429                     | `JuditRateLimitError` (`rate_limit`)                   | 429      | Limite de requisições por minuto (180 por chave numa página da documentação, 500 em outra). Ver `rateLimit` (`Retry-After`, `X-RateLimit-*`, guardados crus).                                               |
| 8   | HTTP 200 com erro de negócio | `JuditApplicationError` (`application_error`)          | 422      | A chamada foi válida, mas o **resultado** é uma exceção, como `LAWSUIT_NOT_FOUND` ou `SECRECY_RESTRICTED`. Ver `code` e `applicationMessage`. HTTP 200 sozinho não é sucesso.                               |
| 9   | HTTP 2xx inutilizável        | `JuditUnexpectedResponseError` (`unexpected_response`) | 502      | Corpo não é JSON ou não bate com o schema. `issues` lista só caminhos de campos (nunca valores). Comparar com as contradições em `src/lib/judit/README.md`: é aqui que um contrato mal documentado aparece. |

**Casos especiais que não são falha** (documentados):

- `POST /lawsuits` com HTTP 404 e `has_lawsuits: false` significa "nenhum processo"; o client devolve lista vazia. Qualquer outro 404 continua erro.
- `status: "pending"` num request não significa dado pronto: o fluxo é assíncrono e não há polling automático.
- Um monitoramento recém-criado não tem resultado: a primeira execução acontece em até 24 h.
- Resposta vinda do cache **também é cobrada** (`responseCameFromCache` só informa a origem).

**Observado na primeira chamada real** (2026-10-14, `POST /lawsuits/count`, CNPJ `A1B2C3D4/E5F6-68`):

- HTTP 200 da nossa rota, `{"total":1,"limited":false}`, em 2,0 s medidos pelo `curl` (no `next dev`, o tempo inclui a compilação da rota no primeiro acesso; o terminal separa `next.js` de `application-code`).
- `response_type: "lawsuits"` não foi rejeitado (contradição 14).
- `POST /lawsuits`: HTTP 200, `has_lawsuits: true`, `request_id` e um processo (CNJ `0000000-39.2026.8.26.0050`, TJSP), também em 2,0 s. Partes no formato do OpenAPI (contradição 16); nenhum indicador de cache (19); `phase`/`status` ausentes e textos `"NÃO INFORMADO"` (33). A lacuna 10 **não** foi resolvida: a rota mostra a saída já normalizada pelo `transform`.
- Campo não documentado `limited` (contradição 32). Lição de suporte: o schema tolerante (`looseObject`) deixou passar um campo novo; um schema estrito teria transformado isso num 502 sem que nada estivesse errado.

**C10. Primeira chamada a uma rota leva ~2 s no `next dev`.** _Observado em 2026-10-14._

- Sinal: `count` e `POST /lawsuits` levaram 2,01 s cada; a documentação promete "milissegundos".
- Hipóteses: limite do documento de teste na JUDIT; rede/TLS; compilação da rota pelo Turbopack.
- Teste que separou (gratuito): `POST /api/dev/judit/lawsuits/synthetic` com corpo `{}`, rota nunca acessada, que responde 400 **sem** chamar a JUDIT: 2,28 s na primeira vez e 0,014 s na segunda.
- Causa provável: compilação no primeiro acesso, que sozinha já leva ~2 s. Sobra pouco ou nada para a JUDIT. Confirmação final: linhas do terminal (`next.js` × `application-code`) ou uma nova chamada a uma rota já compilada.
- Lição de suporte: um número "redondo" e repetido sugere uma causa fixa, e havia uma, mas do nosso lado. Meça a latência em rota já aquecida (ou com `pnpm build && pnpm start`) antes de atribuí-la ao fornecedor.
- **Revisão em 2026-10-14 (noite), com as linhas `next.js` × `application-code`:** no primeiro acesso à rota de `PATCH`, 0,74 s foi compilação (`next.js`) e 0,86 s foi código (a ida à JUDIT). Com as rotas aquecidas, as actions que chamam a JUDIT levaram 0,8–1,2 s, e as que só usam o MongoDB, 43–151 ms. Conclusão revista: a compilação explica só parte; a ida à JUDIT custa perto de 1 s. Foi uma boa lição: "provável" não é "confirmado", e uma medição melhor pode corrigir a primeira conclusão.

**C11. Pedimos recorrência de 30 dias e a JUDIT gravou 1.** _Observado em 2026-10-14._

- Sinal: `POST /tracking` (CNPJ fictício, `recurrence: 30`) respondeu 201 com `"recurrence": 1`; `GET /tracking/{id}` logo depois também trouxe 1.
- Hipóteses: (1) só a resposta da criação estava errada; (2) a JUDIT impõe recorrência 1 (por modalidade, plano ou para o documento de teste); (3) nós enviamos 1.
- Teste que separou: o `GET` derrubou a (1). A (3) é improvável: o teste automatizado confirma que a reserva com 30 gera um corpo com `"recurrence": 30` (o corpo real não vai para o log).
- Causa: desconhecida; a documentação não fala em limite, e o exemplo do monitoramento customizado envia 2 e recebe 2. Pergunta aberta ao tech lead.
- Tentativa de correção: `PATCH /tracking/{id}` com `recurrence: 30` → `400`, `"unrecognized key: 'recurrence'"`. A recorrência não muda depois da criação (resolve a contradição 26 a favor do OpenAPI).
- Efeito: monitoramento diário até ser pausado. O plano já era pausar depois da primeira execução.
- Lição de suporte: gravar o que o fornecedor devolve, e não o que pedimos, foi o que tornou a divergência visível. "Aceito" (201) não quer dizer "aceito como pedido".
- Prevenção (2026-10-14, noite): a mensagem de criação compara o pedido com o devolvido e avisa na hora (`recurrenceWarning` em `src/features/trackings/actions.ts`), enquanto ainda dá para pausar ou excluir. Pergunta ao tech lead: "Inside knowledge", IK1.
- Reproduzido em 2026-10-16 com outra modalidade: monitoramento por CNJ (o fictício, `plan_config_type: "simple_lawsuit_tracking"`), pedido com 30 e gravado com 1. O aviso da criação apareceu e o monitoramento foi pausado em seguida. Como acontece nas duas modalidades, a regra parece ser da conta ou do documento de teste, e não de uma modalidade.

**C12. Envio incerto na criação de um monitoramento.** _Previsto (testado com fetch simulado em 2026-10-14)._

- Sinal: o monitoramento aparece como "Envio incerto", com o motivo na linha de apoio ("Sem resposta clara da JUDIT: …"). Acontece com timeout, falha de rede, 5xx ou um 201 em formato inesperado. Também com um registro preso em `sending`, quando o servidor cai no meio do envio.
- Camada: entre o nosso servidor e a JUDIT. A pergunta não é "deu erro?", é "a JUDIT pode ter criado?".
- Hipóteses: (1) a JUDIT criou e só a resposta se perdeu; (2) nada chegou a ser criado.
- Teste que separa: "Conferir na JUDIT" (`reconcileTrackingAction`), no mínimo 2 minutos depois do envio. Ela lê `GET /tracking` e procura, no nosso código, o mesmo tipo e identificador (com ou sem máscara), não excluído e criado depois da reserva.
- Correção: um resultado confirma a reserva com o `tracking_id` encontrado. Nenhum resultado (com a lista completa) volta a reserva para pendente, e você decide se envia de novo ou descarta. Dois ou mais resultados, ou uma lista com mais de uma página, não concluem nada: resolva pela rota de dev.
- Prevenção: a reserva com índice único impede um segundo envio enquanto houver dúvida; a conferência nunca reenvia sozinha.
- Pontos não confirmados: os filtros de `GET /tracking` não são usados (o OpenAPI não os descreve); o prazo de 2 minutos é escolha nossa; o formato em que a JUDIT guarda o `search_key` é desconhecido, por isso a comparação ignora a máscara.
- Lição de suporte: diante de um timeout num POST que cria algo cobrado, não repita. Primeiro descubra se a operação aconteceu, por uma leitura, e só então decida.

**C13. Um clique, duas chamadas à JUDIT no log.** _Previsto (identificado na revisão de 2026-10-14)._

- Sinal: em `pnpm dev`, um único "Ver resultados" gerava duas linhas `GET /responses/tracking/…` no log.
- Causa: a busca estava num `useEffect`. Em desenvolvimento, o Strict Mode do React monta, desmonta e monta de novo cada componente para revelar efeitos sem limpeza, e o efeito roda duas vezes. Em produção roda uma vez, por isso o problema some depois do build.
- Correção: a busca saiu do efeito e foi para o clique (`useTrackingResults` em `tracking-judit-actions.tsx`).
- Lição de suporte: quando uma chamada aparece em dobro só em desenvolvimento, suspeite do Strict Mode antes de suspeitar do fornecedor. Com uma API cobrada, efeitos não são lugar de chamada que custa.

**C14. Monitoramento por CNPJ sem nenhum resultado.** _Observado em 2026-10-15; é comportamento correto, não falha._

- Sinal: a primeira execução terminou (`completed`) com `responses_count: 0`, e "Ver resultados" mostrou zero processos, embora o CNPJ fictício tenha um processo no datalake.
- Camada: JUDIT (regra da modalidade).
- Hipóteses, em ordem de probabilidade: a modalidade só procura processos novos; a execução falhou; o processo não foi encontrado.
- Teste que separou: `GET /tracking/{id}` mostrou que a JUDIT acrescentou sozinha o filtro `distribution_date_gte` com a data de criação do monitoramento; `GET /requests/{request_id}` da execução mostrou `status: "completed"`.
- Causa: o monitoramento por documento detecta o **nascimento** de processos que "ainda não existiam quando você começou a monitorar" ([tracking-document](https://docs.judit.io/tracking/tracking-document)). O processo fictício foi distribuído antes, então nunca vai aparecer. O "esperado: o processo fictício" do relatório de 2026-10-14 estava errado.
- Prevenção: a tela pode explicar que zero é normal num monitoramento recente. Para testar webhooks, o CNPJ fictício monitorado não serve; é preciso outro gatilho.
- Lição de suporte: "meu monitoramento não trouxe o processo que eu já conheço" é um ticket típico. Antes de investigar, confira a modalidade: por documento só avisa processos novos; para acompanhar um processo que já existe, o monitoramento é por CNJ.

**C15. O ID usado não é do monitoramento.** _Observado em 2026-10-15._

- Sinal: para conferir a execução das 6h, foram usados dois IDs que eram `request_id` de consultas assíncronas criadas na página da empresa, não do monitoramento.
- Camada: pessoa (identificador trocado).
- Teste que separou: o nome da action no log do `pnpm dev`: `└─ ƒ checkAsyncQueryAction(…)` em `POST /empresas/…`, e não `trackingResultsAction` em `POST /monitoramentos`.
- Os quatro IDs desta integração: o id local (nosso; a JUDIT não conhece), o `tracking_id` (o monitoramento na JUDIT), o `request_id` de uma consulta assíncrona e o `request_id` de cada execução do monitoramento (`origin: "tracking"`, `origin_id` igual ao `tracking_id`; o `GET /tracking/{id}` aponta a última execução no campo `request_id`).
- Lição de suporte: antes de investigar, pergunte de onde veio o ID e confira o tipo. Um `request_id` de consulta não diz nada sobre um monitoramento, e vice-versa.

**C16. "Ver resultado" da consulta assíncrona chama a JUDIT a cada clique.** _Observado em 2026-10-15 (item 8 da revisão de 2026-10-14)._

- Sinal: cada clique gerou uma linha `checkAsyncQueryAction` de 0,4 s a 1,4 s, mesmo com a consulta já `completed` no banco.
- Causa: a action sempre faz `GET /requests/{id}` e, quando concluída, `GET /responses` (`src/features/queries/actions.ts:121-175`).
- Correção prevista (etapa 7): não perguntar o status quando o banco já diz `completed` e guardar o resumo na tela.
- Lição de suporte: um botão de "ver" que leva 1 s indica ida e volta a um serviço externo; se o serviço for cobrado, cada clique pode ter custo.

**Lacunas a confirmar nas próximas chamadas reais** (README da JUDIT, contradições):

- formato do corpo de erro: aninhado `{ error: { name, message } }` ou plano `{ error, message, code }` (1). O aninhado foi observado num 400 em 2026-10-14; falta ver um 403/429;
- `code` do application_error como texto ou número (5);
- lista de processos em `response_data` ou em `lawsuits` (10);
- onde fica o indicador de cache (19);
- ~~campos aceitos no `PATCH /tracking` (26)~~: `recurrence` recusado em 2026-10-14; vale o OpenAPI;
- significado do status `suspended` (28) e se existe status de falha num request (24).

**Ao escalar para o suporte da JUDIT**, leve: método e caminho (`call.method`, `call.service`, `call.path`), status HTTP, `errorName`/`code`, horário aproximado e o `request_id` ou `tracking_id`, quando houver. Nunca a chave, nunca o payload com dados processuais.

### D. Git e ferramentas

**D1. `fatal: bad object HEAD` após o PC travar.** _Observado em 2026-10-13._

- Sinal: objetos vazios em `.git/objects` (39 arquivos, gravados no instante do travamento).
- Teste que separou: `git hash-object` de cada arquivo da pasta bateu com o hash do índice, ou seja, o código estava íntegro e só o commit tinha se perdido.
- Correção: backup do `.git`, remover objetos vazios, apontar a branch para o último commit bom (`87f9ccc`), refazer o índice e recriar o commit.
- Lição: antes de qualquer reparo, faça backup e separe "o código está íntegro?" de "o histórico está íntegro?".

**D2. Mensagem de commit "engolida" no título.** _Observado em 2026-10-14._ Sem linha em branco entre título e corpo, o Git trata tudo como título. Corrigido com `--amend` antes do push.

**D3. Comando do agente negado.** _Observado em 2026-10-14._ Pode vir da regra `deny` (só bloqueia a ferramenta `Read`) ou do classificador do modo automático (bloqueou `git diff .env.example` mesmo com o arquivo liberado). "Negado" é uma decisão de permissão, não um erro do projeto. Em 2026-10-14, o classificador também bloqueou o agente de chamar uma server action de monitoramento (via `curl` com o cabeçalho `Next-Action`) como "transação no mundo real", mesmo com a permissão dada no chat: o chat não altera as regras do harness.

**D4. Diário com 91 linhas no Cursor e 1233 no disco.** _Observado em 2026-10-14._

- Sinal: o editor mostrava uma versão antiga do diário. O Git, o GitHub e o `wc -l` mostravam a versão completa.
- Hipóteses: cópia em outra pasta (havia uma em `~/Downloads`, com 59 linhas); branch desatualizada; aba com alterações não salvas.
- Teste que separou: nenhuma versão no Git tinha 91 linhas. O backup de "arquivos não salvos" do Cursor (`~/.config/Cursor/Backups`) tinha exatamente 91 linhas, baseado no arquivo de 12/10.
- Causa: uma aba aberta desde 12/10 tinha uma edição acidental não salva. Com alterações pendentes, o editor não recarrega o arquivo quando o disco muda.
- Correção: descartar a aba (Revert File), sem salvar. Salvar teria sobrescrito as 1233 linhas.
- Lição de suporte: "o arquivo está vazio" pode ser verdade só na tela de quem está olhando. Compare a fonte (disco, Git) com o que o cliente exibe.

**D5. `Next.js encountered uncached data during prerendering or a navigation` em `/empresas`.** _Observado em 2026-10-15._

- Sinal: no terminal do `pnpm dev`, depois de `GET /empresas?q=monitoramentos` (a busca global leva para `/empresas?q=…`), um `Error: Route "/empresas"` apontando `connection()` em `src/lib/data.ts:41`. A página respondeu 200 e funcionou.
- Camada: ferramenta (validação do Next.js em desenvolvimento).
- Causa: com `cacheComponents: true`, o Next valida em desenvolvimento se a navegação para cada página pode ser instantânea. `src/app/(app)/empresas/page.tsx:15` espera `listLawsuits()` antes do próprio `<Suspense>`; no modo `db`, isso chama `connection()` ("espere a requisição real"). O `<Suspense>` do layout cobre o carregamento direto, mas não a navegação entre páginas, porque o layout continua montado (`node_modules/next/dist/docs/01-app/02-guides/instant-navigation.md`, "How validation simulates different navigations"). Ironia: no modo `db`, `listLawsuits()` devolve `[]`.
- Por que `/monitoramentos` não avisa: a página não espera nada no servidor.
- Correção prevista (etapa 7): mover a leitura para um componente dentro do `<Suspense>`. `export const instant = false` só cala o aviso.
- Lição de suporte: um "Error" no terminal de desenvolvimento nem sempre é falha para o usuário final. Aqui o efeito em produção seria uma navegação mais lenta, e o ticket seria "a tela de empresas demora para abrir", não "deu erro".
- Atualização (2026-10-16): leitura movida para dentro do `<Suspense>` em `/empresas`, `/pessoas`, Dashboard e Configurações (as duas últimas tinham o mesmo padrão). Não verificado pelo sintoma: no `pnpm dev` em execução, o aviso não apareceu nem com o código antigo de volta (Dashboard), em carregamento direto e em navegação por clique. Se reaparecer, anotar a página e a navegação que o produziram.

**D6. Rota nova responde 503/500 no `pnpm dev`, mas 404 no build.** _Observado em 2026-10-15._

- Sinal: depois de acrescentar variáveis ao `src/lib/env.ts`, `POST /api/webhooks/judit` respondeu 503 ("configuração inválida") e a rota de dev de consultas respondeu 500 com corpo vazio, sem nenhum token configurado. Nos testes, o mesmo código respondia 404.
- Camada: ferramenta (servidor de desenvolvimento).
- Hipóteses: valor inválido no `.env.local`; bug no schema; o servidor de dev rodando uma versão antiga do `env.ts`, sem as chaves novas (pedir uma chave que o schema não conhece quebra antes de validar).
- Teste que separou: o build novo, servido com `next start` na porta 3100, com o mesmo código e o mesmo `.env.local`, respondeu 404. `pnpm env:check` mostrou o token ausente.
- Causa provável: módulo antigo em memória no `pnpm dev`. O mecanismo exato do recarregamento não foi confirmado.
- Correção: reiniciar o `pnpm dev`.
- Lição de suporte: "funciona no teste e no build, falha no servidor que já estava rodando" aponta para estado antigo em memória. Compare com um processo novo antes de mexer no código.
- Atualização (2026-10-15): o `pnpm dev` voltou a responder certo (401 sem token) sem reinício manual, depois da mudança no `next.config.ts` e no `.env.local`. Explicação provável: o `next dev` reinicia sozinho quando o `next.config.ts` muda, e com isso carregou o `env.ts` novo.

### E. Segurança como falha operacional

**E1. Diagnóstico que vazou parte de um segredo.** _Observado em 2026-10-13._ Um script improvisado imprimiu os 10 primeiros caracteres da chave. Prevenção: só `pnpm env:check`, que mostra nomes, tamanhos e valores não secretos. Avaliado como risco irrelevante em 2026-10-14.

**E2. Repositório público.** Tudo que entra num commit enviado deve ser tratado como publicado. Verificado em 2026-10-14: nenhum segredo no histórico.

### F. Webhooks (etapa 5)

Contrato: a JUDIT repete a entrega só em 5xx ou timeout; um 4xx encerra as tentativas ([webhook/callbacks](https://docs.judit.io/webhook/callbacks)). O status que a rota devolve decide se o evento ainda pode chegar. Tabela completa em `src/features/webhooks/README.md`.

**F1. "A JUDIT diz que entregou, mas não há nada no banco."** _Previsto._

- Hipóteses, em ordem: a rota respondeu 401 (token trocado depois da requisição, ou `callback_url` montada com outro token); 404 (webhook desligado: token vazio ou `DATA_SOURCE` diferente de `db`); o túnel caiu ou mudou de URL (o `cloudflared` gera uma URL nova a cada execução); o servidor de dev estava parado.
- Teste que separou: o terminal do `pnpm dev` (`[webhooks] token ausente ou inválido`, nada, ou `recebido`) e o `GET /api/dev/webhooks`.
- Lição de suporte: é o que a página de suporte da JUDIT pede num ticket de webhook: a `callback_url`, o `request_id`, o `callback_id` e o que o seu servidor respondeu. Um 4xx da sua rota é final: a JUDIT não tenta de novo.

**F2. A mesma entrega chegou duas vezes.** _Previsto (testado com MongoDB em memória)._ A JUDIT reenvia quando não recebe 2xx em 10 s. O índice único de `callback_id` recusa a segunda gravação, e a rota responde 200 com `duplicate: true`. Duas entregas simultâneas também resultam em um único evento. Uma consulta comum gera várias entregas legítimas (cache, atualizada e o código 600), com `callback_id` diferentes: isso não é duplicata.

**F3. Entregas em 503, repetidas pela JUDIT.** _Previsto._ Banco indisponível ou configuração inválida. Procure `[webhooks] falha ao gravar` ou `[webhooks] configuração inválida` no terminal. É o comportamento desejado: o evento não se perde enquanto a JUDIT tenta de novo, desde que a falha não dure além das tentativas dela.

**F4. Token do webhook exposto.** _Previsto (testado)._ A JUDIT devolve a `callback_url` em `payload.tags.callback_url`. Sem o mascaramento, o token iria para o banco e para qualquer tela de diagnóstico. Prevenção: `envelope.ts` troca o token por `[token]` em todo o corpo, e a rota faz o mesmo nas mensagens de erro do log. Dois outros caminhos de vazamento, achados na revisão do próprio código: o `next dev` imprime a URL de cada requisição com a query string (resolvido com `logging.incomingRequests.ignore` no `next.config.ts`), e a JUDIT ecoa a `callback_url` nas respostas dela, que a rota de dev mostraria no terminal (resolvido no `client.ts`, que mascara o token em todo corpo recebido).

- Observado em 2026-10-15: a JUDIT ecoou a `callback_url` na resposta 201 do `POST /requests` (campo não documentado) e em `payload.tags.callback_url` de cada entrega. Nos dois lugares o token apareceu mascarado (`[REDACTED]` pelo client, `[token]` pelo envelope). Se o token vazar, troque-o; entregas pendentes de requisições antigas passarão a receber 401.

**F5. Túnel ligado expõe o app.** _Previsto (testado com cabeçalhos simulados)._ Pela URL do túnel, qualquer pessoa alcançaria páginas, server actions e rotas de dev cobradas. `src/proxy.ts` responde 404 a quem não vem desta máquina, exceto na rota do webhook. Sinal de que o filtro funciona: pela URL do túnel, `/` responde 404 e `/api/webhooks/judit` sem token responde 401.

- Observado em 2026-10-15, pela internet: `/`, `/monitoramentos`, `/api/dev/webhooks` e `POST /api/dev/judit/requests` responderam 404; o webhook sem token ou com token errado, 401.

**F6. Envelope fora do formato.** _Previsto._ Um `callback_id` numérico ou um `payload` que não é objeto indicaria mudança de contrato: a rota responde 400 e registra só os caminhos dos campos (`[webhooks] envelope inválido: callback_id: …`). Como 400 encerra as tentativas, o evento se perde: o log é a única evidência. Campos ausentes ou desconhecidos não recusam a entrega.

### G. Processamento de webhooks (etapa 6)

Receber não é processar. A rota grava e responde 200; o processamento roda depois (`after()`) e termina em `processed`, `ignored` ou `failed`, com uma nota ou o erro. Tudo aparece no detalhe do evento em `/webhooks`. Regras e tabela em `src/features/webhooks/README.md`.

**G1. Evento "Ignorado: Consulta não encontrada nesta aplicação".** _Previsto; esperado para as duas entregas reais de 2026-10-15._

- Hipóteses, em ordem: a consulta foi criada pela rota de dev (`/api/dev/judit/requests`), que não grava em `judit_requests`; a entrega chegou antes de o app gravar o `request_id` (a JUDIT entregou em 2,7 s no teste real); a consulta é de outra aplicação com a mesma chave.
- Teste que separou: procurar o `reference_id` em `judit_requests` (Atlas) e comparar `receivedAt` do evento com `createdAt` da consulta.
- Correção: no segundo caso, nada a fazer: a action processa de novo as entregas antecipadas logo depois de gravar (`processEventsForReference`). Em qualquer caso, "Reprocessar" roda as regras outra vez.
- Lição de suporte: "ignorado" não é erro, é "não é meu". Num ticket, o `reference_id` diz de quem é a entrega.
- Observado em 2026-10-15: as duas entregas da etapa 5 (consulta criada pela rota de dev) ficaram `ignored` com essa nota. Reprocessar de novo deu o mesmo resultado, sem erro.

**G2. Evento parado em "Processando".** _Previsto (testado com MongoDB em memória)._ O servidor caiu entre a reserva do evento e o registro do resultado. Depois de 5 minutos (`STALE_PROCESSING_MS`), "Reprocessar" aceita o evento de novo. Antes disso, recusa, para não processar em dobro algo que pode estar em andamento.

**G3. Evento "Falha" com erro de banco.** _Previsto (testado)._ O banco falhou no meio das regras (`processingError` mostra a mensagem do driver). "Reprocessar" é seguro: o status gravado é fixo e o alerta tem `dedupeKey` com índice único, então repetir não cria nada em dobro.

**G4. Alertas duplicados apesar do `dedupeKey`.** _Previsto._

- Sinal: dois alertas iguais para o mesmo processo ou para o mesmo evento.
- Hipótese principal: o índice `alerts_dedupe_key_unique` não existe no Atlas. O `ensureIndexes` só roda quando o app abre a conexão, e o `pnpm dev` guarda a conexão entre recargas (`globalThis` em `src/db/index.ts`). Um servidor de dev iniciado antes da etapa 6 recompila o código novo, mas nunca cria o índice.
- Teste que separou: Atlas → `alerts` → Indexes.
- Correção: reiniciar o `pnpm dev`. Prevenção: depois de mudar `src/db/collections.ts`, reiniciar sempre (mesma família do D6).

**G5. "Já existe uma consulta igual em andamento para esta empresa."** _Previsto; é comportamento correto._ Há uma consulta da mesma modalidade com status `pending` ou `started` no NOSSO banco, criada há menos de 24 h. O banco só muda quando alguém clica em "Verificar status" ou quando o webhook avisa o fim (600). Primeiro passo: "Verificar status" na consulta anterior. A regra é uma consulta prévia, não um índice: dois envios no mesmo instante ainda passam.

**G6. Monitoramento aparece pausado, mas foi reativado.** _Previsto._ Um aviso de pausa (700 a 703) atrasado, processado depois da reativação, grava `paused` de novo. "Atualizar status" no menu do monitoramento corrige pelo que a JUDIT informa. Lição: webhooks podem chegar fora de ordem; o estado da JUDIT é a fonte da verdade.

**G7. "Entregas por webhook: 0 de N resposta(s)" (vista de suporte).** _Previsto (testado com fetch simulado)._

- Sinal: ao abrir o resultado de uma consulta com entrega por webhook (Histórico de consultas → Ver resultado, ou o card da parte), a linha da vista de suporte diz que faltam entregas.
- Camada: rede entre a JUDIT e a nossa rota / JUDIT.
- Hipóteses, em ordem: a rota estava fora do ar (túnel desligado, `pnpm dev` parado) e a JUDIT desistiu de reenviar (IK10); a origem pública mudou depois da consulta; a relação "uma resposta, uma entrega" não vale para este tipo de consulta (hipótese nossa, `src/features/queries/deliveries.ts`).
- Teste que separou: Diagnóstico de webhooks filtrado pelo `request_id`; o log da rota (`[webhook]`) na hora da consulta; o aviso de fim (600) chegou ou não.
- Correção: nenhuma para os dados: o resultado mostrado veio da consulta direta (`GET /responses`), então nada se perdeu. Para as próximas, manter a rota no ar.
- Lição de suporte: entrega perdida não é dado perdido. A conferência usa a lista que já foi lida para mostrar o resultado; não faz chamada nova.

### H. Proteções de custo (círculo 2 da etapa 7)

Antes de qualquer chamada cobrada, quatro barreiras, nesta ordem: kill switch (`JUDIT_LIVE_CALLS`), allowlist no modo restrito (`JUDIT_ALLOWLIST`), teto diário (`JUDIT_DAILY_CALL_LIMIT`, contado no histórico do app) e, no client, chamada única para a mesma busca e limite por minuto (`JUDIT_MAX_CALLS_PER_MINUTE`). Nenhuma delas deixa a chamada sair do servidor, então nada é cobrado nem entra no histórico. A situação de cada uma aparece em Configurações → Proteção de custo.

**H1. "Teto diário de N chamadas cobradas atingido".** _Previsto (testado com MongoDB em memória)._

- Sinal: o aviso em qualquer ação cobrada; num monitoramento novo, a reserva volta a "Não enviado à JUDIT".
- Hipóteses, em ordem: o dia teve muitas consultas de verdade; um teste repetiu uma ação em loop; o teto está baixo demais para o uso.
- Teste que separou: Configurações mostra "hoje: N"; a página Consultas lista o que foi feito hoje, com hora.
- Correção: esperar a meia-noite (horário de São Paulo) ou subir `JUDIT_DAILY_CALL_LIMIT`.
- Lição de suporte: o teto é do app, não da JUDIT. Quem quer o número oficial olha o consumo do ciclo na JUDIT.

**H2. "Limite de N chamadas à JUDIT por minuto atingido neste servidor".** _Previsto (testado)._ O contador fica na memória do servidor e conta todas as chamadas, inclusive as leituras (status, resultados). Sinal típico de um clique repetido ou de um código em loop. Espere os segundos indicados. Reiniciar o `pnpm dev` zera o contador (é proposital: ele não é guardado).

**H3. "A mesma chamada à JUDIT já está em andamento".** _Previsto (testado)._ Duplo clique, duas abas ou um botão sem bloqueio mandaram a mesma busca enquanto a primeira não tinha respondido. Nada foi cobrado na segunda. Lição: a proteção vale para criações (POST, PATCH, DELETE); leituras podem rodar juntas.

### I. Partes: empresas e pessoas físicas (círculo 2 da etapa 7)

A coleção `companies` virou `parties`, com o tipo do documento (CNPJ ou CPF), e o campo `companyId` virou `partyId` em monitoramentos, consultas e alertas. Quem faz a mudança no banco é `migrateCompaniesToParties` (`src/db/migrations.ts`), na conexão, antes dos índices. Ela pode rodar de novo sem efeito e guarda a coleção antiga como `companies_migrated`.

**I1. Depois da atualização, as empresas sumiram da lista (ou os links quebraram).** _Previsto._

- Sinal: Empresas vazia, monitoramentos sem empresa, mas os dados continuam no Atlas.
- Hipótese principal: o `pnpm dev` estava rodando antes da atualização. Ele recompila o código, mas guarda a conexão aberta (`globalThis` em `src/db/index.ts`), e a migração só roda ao conectar. O código novo lê `parties`, que ainda não existe.
- Teste que separou: Atlas → coleções. Com `companies` e sem `parties`, a migração não rodou.
- Correção: reiniciar o `pnpm dev`. Mesma família do G4 e do D6.
- Lição de suporte: código novo e dados velhos convivem até a migração rodar; "atualizei e sumiu" quase sempre é isso, não perda de dados.

### J. Telas e listas (círculo 2 da etapa 7)

**J1. Um registro antigo "sumiu" da lista.** _Previsto._

- Sinal: um alerta, uma entrega de webhook ou uma consulta que existe no banco não aparece na tela, nem paginando.
- Camada: aplicação (limite de leitura).
- Hipótese principal: a lista chegou ao limite lido do banco (`src/lib/list-limits.ts`: 200 alertas, 200 entregas, 200 consultas de cada fluxo). A tela mostra o aviso "Mostrando ... mais recentes (até 200)", e no Dashboard o número vem com "+".
- Teste que separou: contar os documentos da coleção no Atlas e comparar com o total da paginação.
- Correção: hoje, nenhuma além do aviso; paginação no servidor quando o volume justificar.
- Lição de suporte: "sumiu" pode ser "não foi lido". Antes de suspeitar de perda de dados, confira se a tela lê tudo ou só os mais recentes.

**J2. Dois `<main>` na mesma página.** _Observado em 2026-10-16._

- Sinal: o script de verificação no navegador contou dois elementos `main`; nada aparecia de errado na tela.
- Camada: componente de terceiros (shadcn).
- Causa: `SidebarInset` (`src/components/ui/sidebar.tsx`) já é um `<main>`, e o layout do app punha outro dentro dele, desde a etapa 1.
- Correção: `SidebarInset` passou a ser `div`, com um comentário no arquivo.
- Lição de suporte: erro de acessibilidade não aparece para quem enxerga a tela. O ticket viria de quem usa leitor de tela ("a página tem dois conteúdos principais") ou de uma auditoria, nunca de um print.

**K1. "Saldo de créditos" falha e "Consumo do ciclo" funciona.** _Observado em 2026-10-16._

- Sinal: no cartão "Conta na JUDIT" (Configurações), o saldo mostra "A JUDIT retornou um erro (http)", e o consumo mostra os valores. Log: `JUDIT respondeu HTTP 422 em GET users/credits/balance (HttpUnprocessableEntityError)`.
- Camada: JUDIT (modelo de cobrança da conta).
- Hipóteses: (1) a conta é pós-paga e a rota só atende ao pré-pago; (2) a chave não tem permissão (mas aí o esperado seria 401 ou 403); (3) erro do nosso pedido (é um `GET` sem corpo nem parâmetros).
- Teste que separou: o consumo veio com `max_consumption` (teto de ciclo, o modelo pós-pago), e a [página de créditos](https://docs.judit.io/resource/consumption/credits) avisa que a rota é do pré-pago. Fica a (1), por inferência: a página não lista erros.
- Correção: nenhuma no código. Numa conta pós-paga, o número que se procura é o `remaining` do consumo.
- Lição de suporte: um 422 numa leitura sem parâmetros costuma dizer "esta rota não se aplica à sua conta", e não "o seu pedido está errado". O ticket seria "o saldo não aparece". A resposta é perguntar ou conferir o modelo de cobrança antes de investigar o código.

**K2. "Dados cadastrais: não encontrado" para um CNPJ válido.** _Observado em 2026-10-16._

- Sinal: a página Consultar mostra o cadastro como não encontrado, sem erro. A JUDIT respondeu 200 com `"response_data": []`.
- Camada: JUDIT (dados).
- Causa: o CNPJ fictício da documentação não tem cadastro na base de dados cadastrais; a consulta funcionou. O mesmo aparece com um CNPJ real sem dados na base.
- Lição de suporte: HTTP 200 com lista vazia é "consultei e não há nada", e não uma falha. A confirmação vem da resposta crua (`POST /api/dev/judit/entities`) e do `resultCount: 0` em `sync_queries`. Para um CNPJ real, o próximo passo seria a consulta na Receita em tempo real (on-demand), que é mais cara.

**K3. "Na fila" desde ontem, mas concluída na JUDIT.** _Observado em 2026-10-17._

- Sinal: o histórico de consultas mostra uma consulta processual completa (CNJ fictício, com resumo por IA) "Na fila" desde 16/10, 12:38. `GET /requests/{id}` responde `completed` desde 12:54 do mesmo dia, com duas respostas.
- Camada: aplicação (por desenho). O app não verifica o status sozinho: o estado gravado só muda com "Verificar status".
- Hipótese descartada: requisição travada na JUDIT. A leitura direta mostrou a conclusão.
- Correção: nenhuma por enquanto. É candidata ao círculo 3: indicar há quanto tempo a consulta está na fila, ou verificar ao abrir o histórico.
- Lição de suporte: o ticket seria "minha consulta está na fila há um dia". Antes de escalar para a JUDIT, ler o status direto na fonte (rota de dev ou vista de suporte). O nosso registro é uma foto da última verificação, não o estado atual.

**L1. A ficha do assunto não mostra processos depois de uma consulta que trouxe processos.** _Previsto em 2026-10-17 (círculo 3, fatia 5)._

- Sinal: a página Consultar mostrou a lista, mas a ficha em Minhas informações diz "Nenhum processo guardado". No terminal: `[base] falha ao gravar na base própria (datalake_sync, request_id …)`.
- Camada: banco (base própria) ou aplicação.
- Hipóteses: (1) o MongoDB recusou ou caiu no meio da gravação (a consulta já tinha sido cobrada, então o erro só vai para o log); (2) os índices novos não foram criados porque o `pnpm dev` não foi reiniciado; (3) a consulta foi de contagem ou resumo, que guardam números (`lawsuit_stats`), não processos.
- Teste que separou: procurar `[base]` no log; no Atlas, conferir `lawsuits` e `findings` com o identificador e os índices `lawsuits_cnj_instance_unique` e `findings_subject_item_unique`.
- Correção: repetir a consulta (a regra "o mais novo substitui" não duplica nada).
- Lição de suporte: "paguei e não ficou salvo" tem duas metades. A resposta veio (a tela mostrou); a cópia local falhou. O `request_id` do log permite reler o resultado na JUDIT sem cobrar de novo, quando o fluxo é assíncrono.

**L2. Monitoramento criado "sem webhook" mesmo com o túnel ligado.** _Previsto em 2026-10-17 (círculo 3, fatia 8)._

- Sinal: a mensagem de criação diz "Sem endereço público para o webhook" ou "Webhook configurado pela metade … A reserva continua pendente".
- Camada: ambiente.
- Hipóteses: (1) `JUDIT_WEBHOOK_PUBLIC_ORIGIN` vazia ou o servidor não foi reiniciado depois de preenchê-la; (2) origem preenchida e `JUDIT_WEBHOOK_TOKEN` vazio (pela metade: nada é enviado); (3) origem com `http://` (a JUDIT exige https).
- Teste que separou: `pnpm env:check` mostra as duas variáveis; o card "Recebimento de webhooks" em Configurações diz a situação.
- Correção: preencher as duas, reiniciar e enviar a reserva de novo.
- Lição de suporte: um monitoramento criado sem `callback_url` não ganha uma depois sozinho; os resultados ficam em "Ver resultados". Quem abre o ticket "não recebo alertas" precisa ter a forma de entrega conferida antes de qualquer outra coisa (`delivery` do monitoramento).

**L3. A barra de pesquisa não acha algo que já foi consultado.** _Previsto em 2026-10-17 (círculo 3B)._

- Sinal: "Dado não encontrado" para um nome ou número que está no Acervo.
- Camada: aplicação (busca derivada) ou banco.
- Hipóteses: (1) o texto está no meio da palavra ("llan" não acha "Erllan": a busca é pelo começo, por desenho); (2) a coleção `search_entries` ainda não foi montada, porque o `pnpm dev` não foi reiniciado depois do círculo 3B (a montagem roda na conexão); (3) uma atualização falhou (`[search] falha ao atualizar a busca` no terminal) e a entrada ficou velha; (4) menos de 3 caracteres.
- Teste que separou: procurar pelo começo da palavra; no Atlas, contar os documentos de `search_entries` e ver o índice `search_entries_terms`; procurar `[search]` no log.
- Correção: reiniciar o `pnpm dev`; para forçar a remontagem, apagar a coleção `search_entries` (ela é derivada) e reiniciar.
- Lição de suporte: uma busca derivada pode divergir da fonte. Antes de concluir "o dado sumiu", abrir a ficha pelo endereço (`/acervo/<tipo>/<chave>`), que lê as coleções de origem.

**L4. O número no campo de Consultar aparece embaralhado, com dígitos sobrepostos.** _Observado em 2026-10-17 (círculo 3B)._

- Sinal: ao digitar um CPF no Firefox do usuário, o número formatado aparecia por cima do número digitado, os dois visíveis ao mesmo tempo.
- Camada: aplicação (interface) e navegador.
- Causa: a primeira versão desenhava o número formatado numa camada por cima da caixa e deixava o texto real transparente. No navegador do usuário, o texto de baixo continuou visível. No Firefox e no Chromium de teste, sem janela, o problema não apareceu: uma técnica que depende de duas camadas alinhadas quebra com qualquer diferença de cor ou fonte do navegador.
- Teste que separou: o mesmo CPF fictício no Firefox de teste (limpo) e no do usuário; a captura de tela do teste saiu limpa, a do usuário não.
- Correção: os separadores passaram a ser caracteres da própria caixa (`fieldDisplay` e `stripFieldMask`, em `identify.ts`), uma camada só.
- Prevenção: testes das duas funções; teste no navegador que o usuário usa, não só no do agente.
- Lição de suporte: "no meu computador funciona" não encerra um ticket de tela. Pedir a captura e o navegador de quem reclamou, e desconfiar de soluções que dependem de sobrepor elementos.

### Modelo para novos casos

```
**Título curto do sintoma.** _Observado em AAAA-MM-DD / Previsto / Documentado._

- Sinal: o que apareceu (mensagem, status, log), sem segredos.
- Camada: ambiente / banco / JUDIT / Git / ferramenta.
- Hipóteses, em ordem de probabilidade:
- Teste que separou as hipóteses:
- Causa:
- Correção:
- Prevenção (teste, aviso, documentação):
- Lição de suporte:
```

---

## Inside knowledge

Dúvidas sobre o funcionamento interno da JUDIT que a documentação não responde e que não dá para resolver com uma chamada barata. O agente registra a dúvida, o que já foi observado e o impacto no código. **Você responde**, depois de falar com o tech lead da JUDIT. Ao preencher a resposta, mude o status para _Respondida_ e cite a fonte (pessoa e data).

Os detalhes do contrato que uma chamada real resolve ficam no catálogo, em "Lacunas a confirmar".

**IK0. Uma request assíncrona concluída atualiza o datalake?** _Respondida em 2026-10-14._

- Contexto: a página [request-document](https://docs.judit.io/requests/request-document) se contradiz (README da JUDIT, item 35).
- Resposta: sim, no mesmo fluxo em que os dados são entregues ao cliente. Fonte: tech lead da JUDIT, 2026-10-14.
- Impacto: confirma o desenho híbrido (nenhuma cópia de processo no MongoDB).

**IK1. Por que pedimos `recurrence: 30` e a JUDIT gravou 1?** _Aberta desde 2026-10-14._

- Observado: `POST /tracking` por CNPJ (documento de teste) respondeu 201 com `recurrence: 1`, e o `GET` confirmou (README, item 36; caso C11). O exemplo do monitoramento customizado envia 2 e recebe 2.
- Hipóteses: limite por modalidade, regra do plano ou tratamento especial do documento de teste.
- Impacto: o `PATCH` não aceita `recurrence`; um valor errado só se corrige excluindo e recriando o monitoramento. Define as opções do diálogo (7, 15, 30).
- Resposta:

**IK2. O que exatamente é cobrado no monitoramento?** _Aberta desde 2026-10-14._

- Observado: nenhuma das páginas de tracking tem selo de cobrança (README, item 31). Hoje tratamos tudo como cobrável.
- Dúvidas: cada execução recorrente é cobrada como uma requisição? `GET /tracking/{id}`, `GET /responses/tracking/{id}`, pausar, reativar e excluir são cobrados?
- Impacto: decide se "Atualizar status" e "Ver resultados" podem ser chamados livremente e quanto custa deixar um monitoramento diário ativo.
- Observado em 2026-10-15: cada execução gera uma request própria (`origin: "tracking"`, `origin_id` igual ao `tracking_id`, `cache_ttl_in_days: 1`), como no exemplo de [consumption/history](https://docs.judit.io/resource/consumption/history). Se a cobrança for por request, cada execução diária conta, mesmo sem resultado (a de hoje teve `responses_count: 0`).
- Resposta:

**IK3. O que significa o status `suspended`?** _Aberta desde 2026-10-14._

- Observado: as páginas listam `created`, `updating`, `updated`, `paused` e `deleted`; o OpenAPI acrescenta `suspended`, sem explicação (README, item 28). As páginas de tracking dizem que o monitoramento é "pausado automaticamente" quando a empresa atinge o teto de consumo ou fica sem créditos, com o motivo em `tags.pause_reason` e reativação manual por `resume` ([tracking-document](https://docs.judit.io/tracking/tracking-document#pausando-um-monitoramento)), mas não dizem qual valor de status aparece nesse caso.
- Dúvidas: a pausa automática aparece como `paused` ou como `suspended`? Se não for isso, o que leva a `suspended`, e ele sai com `resume`?
- Impacto: como a tela deve rotular e que ação oferecer.
- Resposta:

**IK4. Os resultados continuam disponíveis depois da pausa?** _Aberta desde 2026-10-14._

- Observado: a pausa devolve o monitoramento com `status: "paused"` ([tracking](https://docs.judit.io/tracking/tracking#pausando-um-monitoramento)), mas a documentação não diz se `GET /responses/tracking/{id}` continua devolvendo as execuções anteriores.
- Impacto: se não continuarem, é preciso ler os resultados antes de pausar (é a ordem que vamos seguir no teste de amanhã).
- Observado em 2026-10-15: depois da pausa, `GET /tracking/{id}`, `GET /responses/tracking/{id}` e a action "Ver resultados" responderam normalmente (200). Como a execução não teve resultados, isso prova que a leitura continua funcionando, mas não que resultados antigos continuam lá.
- Resposta:

**IK5. Em que fuso está o `hour_range`?** _Aberta desde 2026-10-14._

- Observado: o monitoramento de teste voltou com `hour_range: 6`; a tela diz "às 6h", sem fuso (relatório, item 14).
- Dúvida: UTC ou horário de Brasília? É a hora de início da execução ou uma janela?
- Impacto: o texto da tela e o horário em que vale conferir os resultados. A primeira execução também pode responder isso.
- Observado em 2026-10-15: com `hour_range: 6`, a execução começou às 06:55:25 UTC (03:55 em Brasília) e terminou às 07:01:07 UTC. Indício forte de UTC, com um minuto definido pela JUDIT (`execution_minute: 55`, campo fora da documentação). É uma observação só; falta a confirmação.
- Resposta:

**IK6. O CNJ fictício serve para monitoramento?** _Aberta desde 2026-10-14._

- Contexto: o Hot Storage devolveu `0000000-39.2026.8.26.0050` para o CNPJ fictício; ele já está na allowlist.
- Dúvidas: um monitoramento por CNJ desse processo é aceito, gera execuções e é cobrado?
- Impacto: sem isso, o fluxo de monitoramento por CNJ não será testado ao vivo.
- Resposta:

**IK7. Um request pode terminar em falha?** _Aberta desde 2026-10-14._

- Observado: a documentação mostra `pending`, `started` e `completed`, mas nenhum status de falha (README, item 24).
- Dúvida: o que acontece quando o tribunal está fora do ar ou o documento não existe: `completed` com zero respostas, um status não documentado, ou o request fica parado?
- Impacto: hoje a tela não sabe distinguir "ainda processando" de "travado".
- Resposta:

**IK8. O que significa `limited` em `/lawsuits/count`?** _Aberta desde 2026-10-14._

- Observado: `"limited": false` na resposta real, ausente da página e do OpenAPI (README, item 32).
- Hipótese não confirmada: a contagem foi truncada por um teto.
- Impacto: se for isso, a tela deveria dizer "pelo menos N processos" quando vier `true`.
- Resposta:

**IK9. Como o webhook é cadastrado para a nossa conta?** _Aberta desde 2026-10-14._

- Contexto: a etapa 5 depende disso. Existe `callback_url` por monitoramento (`updateTrackingCallbackUrl` já está pronto), mas não sabemos se a conta também precisa de um cadastro feito pelo suporte.
- Dúvidas: basta o `callback_url`, ou é preciso abrir um pedido ao suporte? Existe um ambiente ou um evento de teste para disparar uma entrega sem esperar uma execução real?
- Ainda não pesquisado na documentação: autenticação das entregas, política de novas tentativas e ordem dos eventos. Isso será lido na etapa 5; o que a documentação não cobrir vira um novo item aqui.
- Encontrado na documentação em 2026-10-15 ([webhook/callbacks](https://docs.judit.io/webhook/callbacks)): há duas formas de cadastro, uma URL para a conta inteira, pedida ao suporte (recomendada), ou `callback_url` em cada requisição. Entrega por `POST` JSON numa URL HTTPS pública; resposta 2xx em menos de 10 s; em 5xx ou timeout, novas tentativas com backoff exponencial; indisponibilidade longa perde eventos. Segurança: só HTTPS e allowlist de IPs da JUDIT, pedidos ao suporte; nenhuma assinatura documentada. Idempotência: a página manda usar `callback_id` e, em outro trecho, `request_id` + `cached_response` (README da integração, item 39). Continuam abertos: um evento de teste e a lista de IPs.
- Observado em 2026-10-15: o `callback_url` por requisição funcionou sem nenhum cadastro com o suporte. Uma consulta assíncrona do CNPJ de teste gerou duas entregas em 7 s (o processo, do cache, e o código 600). Para monitoramentos (`PATCH /tracking` com `callback_url`), ainda não testado.
- Resposta:

**IK10. Quantas vezes a JUDIT reenvia um webhook, e por quanto tempo?** _Aberta desde 2026-10-15._

- Documentado ([webhook/callbacks](https://docs.judit.io/webhook/callbacks)): em 5xx ou timeout (mais de 10 s), novas tentativas com backoff exponencial; "se sua URL ficar indisponível por muito tempo, perdemos eventos". Um 4xx não é repetido.
- Dúvidas: quantas tentativas e em que intervalos? Qual a janela total? Existe como pedir a reentrega de um evento perdido, ou um painel com o histórico de entregas e o status que o nosso servidor respondeu?
- Hipótese: uma entrega perdida não é um dado perdido, porque a resposta continua disponível por `GET /responses?request_id=…` (polling). Daria para conferir as entregas que faltam comparando o que chegou com o que a API lista.
- Impacto: quanto tempo o app pode ficar fora do ar sem perder eventos, e se a etapa 6 ou 7 precisa de uma conferência por polling.
- Resposta:

**IK11. Como chegam as entregas de um monitoramento?** _Aberta desde 2026-10-15._

- Contexto: a etapa 6 processa entregas de monitoramento (`reference_type: "tracking"`), mas nenhuma foi observada: o CNPJ de teste não gera resultados (C14), e o CNJ fictício depende do IK6.
- Dúvidas: cada execução termina com um `application_info` 600, como uma consulta? Um monitoramento por CNJ manda a versão do cache e depois a atualizada, ou só uma entrega por movimentação? O `response_data` traz só as movimentações novas ou o processo inteiro (a página diz "o processo por completo")?
- Impacto: hoje, um 600 de monitoramento é registrado sem ação, e cada entrega de monitoramento por CNJ gera um alerta. Se vierem duas versões por execução, sairão dois alertas de movimentação.
- Resposta:

**IK12. Posso publicar respostas gravadas da JUDIT?** _Aberta desde 2026-10-15._

- Contexto: a etapa 8A quer uma demonstração que reproduza respostas reais gravadas nos testes, para rodar sem chave. O repositório é público.
- Dúvidas: o contrato ou os termos de uso permitem republicar respostas da API (mesmo anonimizadas) num repositório público? E as respostas do CNPJ de teste (`A1B2C3D4/E5F6-68`), que são fictícias? A busca na documentação pública (2026-10-15) não achou termos de uso nem regra de redistribuição.
- Impacto: decide se as gravações de CNPJs reais podem sair desta máquina. Até a resposta, ficam fora do Git.
- Resposta:

**IK13. Existe um CPF fictício para testes?** _Aberta desde 2026-10-15._

- Contexto: o uso guiado da etapa 7 propôs pessoas físicas no app. A JUDIT aceita CPF no monitoramento por documento, nas consultas e nos dados cadastrais ([tracking-document](https://docs.judit.io/tracking/tracking-document)). O único documento de teste citado na documentação é o CNPJ `A1B2C3D4/E5F6-68`; a busca de 2026-10-15 não achou um CPF equivalente, nem um nome de teste.
- Dúvidas: há um CPF (e um nome) que devolva dados fictícios, como o CNPJ de teste? Uma chave de sandbox (comercial@judit.io, [postman-collection](https://docs.judit.io/resource/postman-collection)) resolveria?
- Impacto: sem isso, pessoa física e busca por nome não podem ser testadas ao vivo (allowlist em `guard.ts`), o que pesa nas escolhas C1-5 e C1-6 de `docs/etapa-7-escopo.md`.
- Resposta:

**IK14. O preço de uma consulta muda com a quantidade de processos devolvidos?** _Aberta desde 2026-10-16._

- Contexto: o usuário quer trocar a allowlist por proteções menos restritivas, entre elas uma contra consultas enormes (uma empresa com milhares de processos). As páginas falam em "cobrança por requisição" e o exemplo do [histórico de consumo](https://docs.judit.io/resource/consumption/history) precifica por requisição (e anexos à parte), mas não dizem se o volume devolvido muda o preço, nem se ler as páginas seguintes (`GET /responses?page=...`) é cobrado.
- Impacto: decide se a proteção de volume serve para economizar crédito ou só para não travar a tela e o servidor.
- Resposta:

**IK15. Qual é o formato do RJI e da OAB?** _Aberta desde 2026-10-17._

- Contexto: o círculo 3 quer reconhecer o identificador só pela digitação. O único exemplo de RJI ([warrant](https://docs.judit.io/criminal-consultation/warrant)) é `"00000000000000000000"`: 20 dígitos, como o CNJ sem máscara. Os exemplos de OAB discordam entre UF antes e depois (`SP123456`, `123456SP`, `99999RJ`; README item 47).
- Dúvidas: o RJI do BNMP 2.0 tem letras, dígito verificador ou só números? A API aceita a OAB nas duas ordens? Com ou sem barra e zeros à esquerda?
- Impacto: decide a regra que separa CNJ de RJI e o que normalizar na OAB antes de enviar.
- Resposta:

---

## Modelo de entrada

### Data / funcionalidade

**O que eu queria construir**

Descreva a finalidade da funcionalidade em uma ou duas frases.

**Resumo técnico**

O agente pode ajudar a listar os arquivos e as responsabilidades alteradas.

**Fluxo de dados**

Registre o caminho desde a ação do usuário até a resposta visível, incluindo servidor, APIs externas e banco de dados quando aplicável.

**Como testei**

Inclua o comando ou os passos manuais, o resultado observado e o que o teste não cobre.

**Falhas que sei investigar agora**

Anote um ou dois sintomas e onde começaria a procurar a causa.

**O que ainda não entendo**

Registre dúvidas específicas. Elas viram o ponto de partida para a próxima sessão.

**Perguntas de verificação**

- Pergunta 1:
- Pergunta 2:

---

## Entradas

Adicione novas entradas abaixo. Não é necessário preencher tudo perfeitamente; o objetivo é tornar visível a evolução do seu entendimento.

### 2026-10-12 / Preservação do protótipo visual

**Resumo técnico**

Primeiro commit (`2af39e6`) na branch `main`, com o protótipo de mock data. Antes do commit: arquivos revisados, varredura de segredos, regra `.claude/settings.local.json` no `.gitignore` e lint, typecheck, format e build passando. Criada a tag anotada `prototype-v0.1.0` e a GitHub Release correspondente, como referência fixa para comparar a evolução do produto.

**Perguntas de verificação**

- Pergunta 1: O que acontece com a tag `prototype-v0.1.0` quando novos commits entram em `main`?
- Pergunta 2: Como você voltaria a rodar exatamente esse protótipo localmente?

### 2026-10-12 / Credencial da JUDIT no ambiente local

**Resumo técnico**

Criados `.env.local` (ignorado pelo Git, permissão `600`) e `.claude/settings.local.json`, que bloqueia a leitura de `.env*` pelo Claude Code. A chave foi colada localmente, sem passar pelo chat. Ela é lida apenas via `getServerEnv` (`src/lib/env.ts`, server-only). A checagem com `@next/env` confirmou só a presença do valor. A JUDIT não foi chamada, então a chave ainda não foi validada.

**Perguntas de verificação**

- Pergunta 1: O que aconteceria com a chave se a variável se chamasse `NEXT_PUBLIC_JUDIT_API_KEY`?
- Pergunta 2: A regra `deny` impede qualquer programa de ler o `.env.local`? Qual é a proteção real contra a chave ir para o GitHub?

### 2026-10-12 / O Claude Code precisa de `CLAUDE.md`?

**Resumo técnico**

O repositório não tinha `CLAUDE.md`, mas o `AGENTS.md` já era carregado automaticamente pelo Claude Code. `CLAUDE.md` é só o nome tradicional. O comando `/memory` mostra quais arquivos de instrução estão ativos na sessão.

### 2026-10-12 / Criação do `CLAUDE.md`

**Resumo técnico**

Criado `CLAUDE.md` com a única linha `@AGENTS.md`, que importa as instruções sem duplicá-las. Não houve commit.

### 2026-10-12 / Custo e velocidade do agente

**Resumo técnico**

Mais tokens não significa mais rapidez. `/fast` acelera a saída do mesmo modelo, com custo maior; `/model` escolhe o modelo e o esforço de raciocínio. Subagentes em paralelo foram desaconselhados porque contrariam o trabalho em incrementos pequenos e acompanháveis.

### 2026-10-13 / Fase 0: client JUDIT, erros e guarda de custo

**Resumo técnico**

Criado `juditRequest` (`src/lib/judit/client.ts`), único ponto de contato com a JUDIT: header `api-key`, timeout de 15s, erros tipados (`errors.ts`) e validação Zod tolerante. `guard.ts` bloqueia chamadas sem `JUDIT_LIVE_CALLS=enabled` e fora da allowlist. Vitest adicionado; 21 testes com `fetch` simulado, sem rede.

**Perguntas de verificação** (respostas em "Perguntas e respostas")

- Por que uma resposta HTTP 200 da JUDIT ainda pode representar uma falha, e em que isso difere de um HTTP 404?
- Se um `POST /requests` der timeout, por que repetir a chamada automaticamente pode ser um problema?

### 2026-10-13 / Fase 1: serviço lawsuits e rotas de teste manual

**Resumo técnico**

Criadas cinco funções síncronas em `src/lib/judit/lawsuits.ts` (dados cadastrais, lista, contagem, sintética e processo por CNJ), lidas do datalake da JUDIT. As rotas `src/app/api/dev/judit/...` só respondem em desenvolvimento com o kill switch ligado. Um teste revelou um bug (404 de erro aceito como lista vazia), já corrigido.

**Perguntas de verificação** (respostas em "Perguntas e respostas")

- Por que `POST /lawsuits` usa timeout de 180s com `onDemand` e de 15s nos outros casos?
- Por que um 404 em `GET /lawsuits/{cnj}` continua sendo erro, enquanto o 404 de `POST /lawsuits` vira lista vazia?
- Qual a diferença entre o dado do datalake e o do tribunal, e quando o `on_demand` muda isso?
- Por que a rota local devolve 502 quando a JUDIT responde 401?

### 2026-10-13 / Fase 2: requests e responses (fluxo assíncrono)

**Resumo técnico**

Criadas seis funções em `src/lib/judit/requests.ts` para o fluxo assíncrono: criar requisição, consultar status, listar histórico e buscar respostas (inclusive de monitoramentos). Sem polling automático. `responseCameFromCache` lê o indicador de cache em quatro lugares possíveis. Cinco rotas de dev novas, 51 testes, build ok. Diário ganhou resumos e seção Q/A.

**Perguntas de verificação** (respostas em "Perguntas e respostas")

- Depois de criar uma requisição, por que receber `status: "pending"` não significa que há algum dado pronto?
- Por que podem existir duas respostas para o mesmo `request_id`, e qual delas é a mais atual?
- Por que o código não consulta o status automaticamente em loop?

### 2026-10-13 / Fase 3: tracking (monitoramentos)

**Resumo técnico**

Criadas sete funções em `src/lib/judit/tracking.ts`: criar, listar, consultar, alterar recorrência, pausar, reativar e excluir monitoramentos. Por CNJ, vigia andamentos; por CPF/CNPJ/OAB, detecta processos novos. Primeira execução em até 24h. `recurrence` sem padrão; o DELETE de dev exige `?confirm=delete`. 61 testes, build ok.

**Perguntas de verificação** (respostas em "Perguntas e respostas")

- Qual a diferença entre monitorar um CNJ e monitorar um CNPJ?
- Por que não há nenhum resultado logo depois de criar um monitoramento?
- Na dúvida, por que pausar é melhor que excluir?

### 2026-10-13 / Encerramento do dia

**Resumo técnico**

Commit da branch `feat/judit-client` com o client JUDIT, os serviços lawsuits, requests e tracking, as rotas de dev, 61 testes e o diário. O resumo da sessão e as pendências manuais ficaram na memória local do Claude Code, para serem apresentados no início da próxima sessão.

### 2026-10-13 / Retomada: leitura do relatório da sessão anterior

**Resumo técnico**

Relido o relatório da sessão anterior (commit `5423aa5`, fases 0–3 do client JUDIT, 61 testes, nenhuma chamada real feita). Confirmado que a allowlist ainda só contém o CNPJ fictício e a branch não foi enviada ao remoto. Pendências manuais apresentadas para decidir o próximo passo.

### 2026-10-13 / CNJs de teste, chamada real adiada e revisão do commit

**Resumo técnico**

Não usaremos CNJs reais buscados na web: envolvem dados de terceiros e geram cobrança. A documentação oferece o CNPJ fictício `A1B2C3D4/E5F6-68` e uma chave de sandbox via comercial@judit.io. Chamada real adiada. Proposto roteiro de revisão do commit `5423aa5`.

**Perguntas de verificação** (respostas em "Perguntas e respostas")

- Por que um processo trabalhista de uma padaria pode expor dados de uma pessoa física, mesmo que a busca seja pelo CNPJ da empresa?

### 2026-10-13 / Revisão 1/6: `guard.ts`

**Resumo técnico**

Revisado `guard.ts`: kill switch em toda chamada e allowlist só com o CNPJ fictício. Achado: a allowlist não cobre chamadas por ID nem listagens da conta (`listRequests`, `listTrackings`, `deleteTracking`), que passam só pelo kill switch. O comentário do arquivo promete mais do que entrega. Decisão pendente: opções A, B ou C.

**Perguntas de verificação** (respostas em "Perguntas e respostas")

- Com `JUDIT_LIVE_CALLS=Enabled` (com "E" maiúsculo), o que acontece, e por que isso é desejável?
- Por que a allowlist não consegue proteger uma chamada como `getTracking(id)`?

### 2026-10-13 / Como acessar um commit

**Resumo técnico**

Explicado que o commit `5423aa5` é o estado atual da branch `feat/judit-client`: os arquivos já estão na pasta e podem ser abertos no editor. `git log`, `git show` e `git show <hash> -- <arquivo>` mostram o histórico e o que cada commit mudou.

### 2026-10-13 / Encerramento da revisão do commit `5423aa5`

**Resumo técnico**

Revisão encerrada pela opção A: o comentário de `guard.ts` e o README agora dizem que a allowlist não cobre chamadas por ID nem listagens da conta. A correção definitiva fica para quando houver banco. Adicionadas ao Q/A 14 perguntas de entrevista sobre o repositório, com respostas.

### 2026-10-13 / Push e pull request

**Resumo técnico**

Explicada a diferença: `git push` copia os commits da branch local para o GitHub; o pull request é um pedido, feito no GitHub, para juntar essa branch à `main`, com espaço para revisão e discussão. O push vem antes do PR. Confirmado que `JUDIT_LIVE_CALLS=` já está no `.env.example`.

### 2026-10-13 / Push da branch e quando fazer merge

**Resumo técnico**

Commitadas as mudanças da revisão e feito o push de `feat/judit-client` para o GitHub; PR não aberto. Discutido que "produto inacabado" é diferente de "fatia inacabada": a `main` pode receber fatias pequenas, testadas e isoladas. O `.env.example` ficou fora do commit.

### 2026-10-13 / Pull request #1

**Resumo técnico**

Aberto o PR #1 (`feat/judit-client` → `main`), com descrição, limitações conhecidas (nenhuma chamada real feita, lacuna da allowlist) e verificações. O merge fica com você, no GitHub. Depois dele, a fase 2 (banco) começa numa branch nova a partir da `main` atualizada.

### 2026-10-13 / Onde está cada versão do código

**Resumo técnico**

Conferido com `git fetch`, `git status` e `gh pr view`: a `main` do GitHub continua no protótipo (`2af39e6`); a branch `feat/judit-client` no GitHub tem os dois commits do client; o PR #1 está aberto e sem conflitos. Localmente, `.env.example` e o diário têm mudanças não commitadas.

### 2026-10-13 / Fase 2a: persistência de empresas e monitoramentos

**Resumo técnico**

Na branch `feat/persistence`: índice único parcial impede dois monitoramentos ativos do mesmo identificador (migration `0001`). `ensureCompany`, `createTracking` e listagens validam no servidor. Testes usam PostgreSQL real em processo (PGlite). 80 testes passando. Telas ainda não usam o banco; migration não aplicada.

**Perguntas de verificação** (respostas em "Perguntas e respostas")

- Por que a regra "um monitoramento ativo por identificador" fica num índice do banco, e não numa consulta antes do `INSERT`?
- Por que o índice é "parcial" (`WHERE status IS DISTINCT FROM 'deleted'`) e não um UNIQUE simples?
- Por que `createTracking` valida a entrada de novo, se o formulário já valida?

### 2026-10-13 / Troca do PostgreSQL pelo MongoDB

**Resumo técnico**

Banco trocado para MongoDB (Atlas, driver oficial, sem Mongoose). Drizzle, migrations e PGlite removidos; tipos agora em `src/db/models.ts`. Índices em `ensureIndexes`, chamado na conexão. A regra anti-duplicata virou índice parcial sobre o campo `active`. Testes usam `mongod` real temporário. 78 testes passando.

**Perguntas de verificação** (respostas em "Perguntas e respostas")

- Por que o documento de monitoramento precisa de um campo `active`, se o `status` já diz se ele foi excluído?
- O que o PostgreSQL garantia sozinho que, no MongoDB, passou a depender do nosso código?

### 2026-10-13 / Fase 2b: `DATA_SOURCE` escolhe demo ou MongoDB

**Resumo técnico**

`DATA_SOURCE=demo|db` escolhe a origem dos dados do app inteiro em `src/lib/data.ts`. No modo `db`, as páginas leem o MongoDB na requisição (`connection()` + `Suspense`), e criar monitoramento grava via Server Action. Testado por HTTP contra um MongoDB temporário. 83 testes; build ok nos dois modos.

**Perguntas de verificação** (respostas em "Perguntas e respostas")

- Por que `data.ts` chama `connection()` antes de consultar o MongoDB no modo `db`?
- A Server Action só é usada pelo formulário. Por que ela confere o `DATA_SOURCE` mesmo assim?

### 2026-10-13 / Recuperação do Git após travamento do PC

**Resumo técnico**

O travamento corrompeu o commit da Fase 2b: a branch apontava para objetos vazios. O working tree estava íntegro (hashes conferidos com o índice). Com backup do `.git`, os objetos vazios foram removidos, a branch voltou para `87f9ccc` e o commit foi recriado (`8cb096f`). Testes, lint, typecheck, format e build passaram.

**Perguntas de verificação** (respostas em "Perguntas e respostas")

- Por que o código não se perdeu, embora o commit tenha sido corrompido?
- Por que conferir `git hash-object` contra o índice antes de recriar o commit?

### 2026-10-13 / Conexão com o MongoDB Atlas

**Resumo técnico**

No diálogo "Connect" do Atlas, o método certo é "Drivers" (Node.js), porque quem conecta é o servidor Next.js, usando o driver oficial `mongodb`. A string `mongodb+srv://` vai para `MONGODB_URI` no `.env.local`, com a senha do usuário do banco, nunca no código nem no chat.

**Perguntas de verificação** (respostas em "Perguntas e respostas")

- Por que a senha da string de conexão é a do usuário do banco, e não a da sua conta no Atlas?

### 2026-10-13 / String de conexão do Atlas recebida

**Resumo técnico**

A string colada no chat ainda tinha o marcador `<db_password>`, então nenhuma senha foi exposta. Ela não traz `retryWrites` nem `w=majority`, mas o driver e o servidor atuais já usam esses padrões. Próximo passo: colar a string, com a senha real, no `.env.local` e subir o app no modo `db`.

### 2026-10-13 / Onde fica a senha do usuário do banco

**Resumo técnico**

O Atlas mostra a senha do usuário do banco só uma vez, na criação, e não deixa consultá-la depois. Se ela não foi guardada, a saída é gerar uma nova em "Database Access" > "Edit" > "Edit Password". Senha autogerada evita caracteres especiais que quebram a URI.

### 2026-10-13 / Variáveis do `.env.local`

**Resumo técnico**

O código lê cinco variáveis, todas validadas em `src/lib/env.ts`: `MONGODB_URI`, `MONGODB_DB`, `DATA_SOURCE`, `JUDIT_API_KEY` e `JUDIT_LIVE_CALLS`. `NODE_ENV` é definida pelo Next. Para testar o banco, `JUDIT_LIVE_CALLS` pode ficar vazia, sem chamadas reais à JUDIT.

### 2026-10-13 / Primeiro teste no modo `db`: app continuou em `demo`

**Resumo técnico**

A página mostrava "Dados de demonstração". O `loadEnvConfig` do Next revelou nomes errados no `.env.local` (`MONGO_URI`, `MONGO_DB_NAME`, `DATA_SOURCE=mongodb`) em vez de `MONGODB_URI`, `MONGODB_DB` e `DATA_SOURCE=db`. O MongoDB nem foi contatado. Lição: perguntar ao carregador o que ele leu.

**Perguntas de verificação** (respostas em "Perguntas e respostas")

- Por que um HTTP 200 não provava que o app estava lendo o MongoDB?

### 2026-10-13 / Fechamento da sessão

**Resumo técnico**

Criados `docs/relatorio-de-progresso.md` (estado, pendências em ordem, checklist do teste `db`, tabela de falhas) e `docs/logs/2026-10-13-sessao.md` (log sanitizado). Servidor encerrado. O `.env.local` ainda tem os nomes errados. Nada foi commitado nesta etapa.

### 2026-10-14 / Diagnóstico do modelo de segurança do `.env`

**Resumo técnico**

Repositório público. `.env.local` nunca entrou no Git. `.env.example` está em `2af39e6` (publicado) e `8cb096f` (local), com conteúdo não revisado. O bloqueio do agente cobre só a ferramenta `Read`, não o terminal. Nenhuma URI do Mongo com senha no histórico rastreado.

**Perguntas de verificação** (respostas em "Perguntas e respostas")

- Por que apagar um segredo do `.env.example` num commit novo não basta, se o commit antigo já foi enviado ao GitHub?
- Que diferença existe entre "o agente não deve ler o `.env.local`" e "o agente não consegue ler o `.env.local`"?

### 2026-10-14 / `.env.example` liberado para o agente e atualizado

**Resumo técnico**

O `deny` agora lista só arquivos de segredo (`.env`, `.env.local`, `.env.*.local`, `.env.development|production|test`). Conferência: `.env.example` vazio nas três versões, sem vazamento. Ele ainda descrevia o PostgreSQL (`DATABASE_URL`); foi reescrito com as cinco variáveis de `src/lib/env.ts`.

### 2026-10-14 / Procedimento de segredos e primeiro ping no Atlas

**Resumo técnico**

Criados `pnpm env:check [--db]` (nomes, tamanhos, ping só leitura, sem valores) e `src/lib/env.test.ts` (`.env.example` vazio e sincronizado com `env.ts`). README ganhou o procedimento. Ping: rede ok, `bad auth`; a URI ainda contém `<db_password>`.

**Perguntas de verificação** (respostas em "Perguntas e respostas")

- Por que `bad auth` prova que o IP já está liberado no Atlas?

### 2026-10-14 / Conexão com o Atlas funcionando

**Resumo técnico**

O `bad auth` tinha duas causas em sequência: a senha ficou entre `<` e `>` (sobra do marcador do Atlas) e, depois, a senha não era a do usuário do banco. Com uma senha nova gerada no Atlas, `pnpm env:check --db` conectou ao banco `raio_x`.

### 2026-10-14 / O que é o `.env.example`

**Resumo técnico**

O `.env.example` não protege nada sozinho: é a documentação versionada das variáveis. A proteção vem de manter valores fora do Git (`.gitignore`), seguindo o princípio "configuração no ambiente" do Twelve-Factor App. Convenção comum, não padrão formal; em produção, variáveis vêm da plataforma ou de um cofre de segredos.

### 2026-10-14 / Quem lê o `.env.local` e como o segredo chega aos serviços

**Resumo técnico**

O servidor Next lê o `.env.local` ao iniciar e coloca os valores em `process.env`. Git, navegador e agente não leem. A chave vai à JUDIT no cabeçalho `api-key` via HTTPS; a URI conecta ao Atlas via TLS. Em produção, os valores vêm do painel da plataforma, não do arquivo.

### 2026-10-14 / Balanço da segurança do `.env`

**Resumo técnico**

Resolvido: nenhum segredo no Git, `.env.example` sincronizado e testado, `env:check`, senha do Mongo nova. Aberto: trocar a `JUDIT_API_KEY` (prefixo vazado), commitar o procedimento, conferir Network Access e papel do usuário no Atlas, `JUDIT_LIVE_CALLS` ligado. Webhook e demo pública ficam para depois.

### 2026-10-14 / Commit do procedimento e barreira técnica possível

**Resumo técnico**

Commits locais `561a05f` (procedimento de segredos) e `6532c05` (documentos). Chave JUDIT mantida; `0.0.0.0/0` no Atlas aceito por ora. Barreira técnica possível: sandbox do Claude Code, que aplica as regras `deny` de leitura também ao terminal. O `env:check` lê o `.env.local`, mas só exibe valores não secretos.

### 2026-10-14 / Roteiro do teste do modo `db`

**Resumo técnico**

Roteiro em seis passos: subir `pnpm dev`, conferir o selo "Banco de dados", ver as coleções criadas pelo `ensureIndexes`, gravar o CNPJ fictício `A1B2C3D4/E5F6-68`, recarregar (persistência), repetir (duplicado barrado pelo índice `trackings_active_search_key_unique`) e conferir no Atlas.

**Perguntas de verificação** (respostas em "Perguntas e respostas")

- Por que as coleções aparecem no Atlas antes de qualquer monitoramento ser gravado?

### 2026-10-14 / Teste do modo `db` concluído

**Resumo técnico**

O app criou as quatro coleções ao conectar. O CNPJ fictício gerou um documento em `companies` e um em `trackings`, sem ID da JUDIT. A repetição mostrou "Já existe um monitoramento ativo…", e o banco seguiu com um documento: o índice único parcial barrou a duplicata. Etapa 2 concluída.

### 2026-10-14 / Catálogo de investigação de falhas

**Resumo técnico**

Criado o catálogo no topo do diário, a partir dos logs, do README da JUDIT e de `errors.ts`/`dev-route.ts`: mapa de camadas, triagem por sinal e casos de ambiente, Atlas, JUDIT (classe → status da rota dev → hipótese), Git e segurança. Cada caso marcado como observado, previsto ou documentado.

**Perguntas de verificação** (respostas em "Perguntas e respostas")

- Uma rota `/api/dev/judit/...` respondeu 404. Por que isso não significa que o endereço está errado, e qual o primeiro comando a rodar?
- Um `POST /requests` deu 504 na rota de dev. Por que não repetir a chamada imediatamente?

### 2026-10-14 / `main` atualizada após o merge do PR #2

**Resumo técnico**

`git switch main` e `git pull` fizeram fast-forward de `2af39e6` para `c8e84b8` (merge do PR #2, `feat/persistence`). A `main` agora tem MongoDB, `DATA_SOURCE`, client da JUDIT, rotas de dev e `check-env`. Nenhum conflito: a `main` local não tinha commits próprios.

### 2026-10-14 / Plano da etapa 3 e preparo da primeira chamada real

**Resumo técnico**

`pnpm env:check` mostrou `JUDIT_LIVE_CALLS="enabled"` e chave definida, com o `next dev` rodando na porta 3000. A página `/cache-judit/count` confere com `countLawsuits`. Plano: `count`, depois `POST /lawsuits` (lacuna 10) e só então a fatia vertical na página da empresa.

### 2026-10-14 / Primeira chamada real à JUDIT

**Resumo técnico**

`curl` na rota de dev `lawsuits/count` com o CNPJ fictício: HTTP 200, `{"total":1,"limited":false}`, 2,0 s. Contrato confirmado; `response_type` aceito. `limited` não está documentado: registrado como contradição 32 no README e no catálogo. Schema tolerante evitou um falso 502.

**Perguntas de verificação** (respostas em "Perguntas e respostas")

- Se a chamada respondesse `{"total": 0}`, isso provaria que a integração falhou?
- Por que o campo `limited` não quebrou a validação, e por que não o adicionamos ao schema?

### 2026-10-14 / Hot Storage real com o CNPJ fictício

**Resumo técnico**

`POST /lawsuits` devolveu um processo fictício (TJSP, CNJ válido). Confirmou partes no formato do OpenAPI e campos `phase`/`status` ausentes. A lacuna 10 continua aberta: o `transform` renomeia a lista para `lawsuits` antes da rota responder. Os 2,0 s nas duas chamadas ainda não foram explicados.

**Perguntas de verificação** (respostas em "Perguntas e respostas")

- Por que a saída da rota de dev não prova se a JUDIT usa `lawsuits` ou `response_data`?
- O que fazer com um campo que chega como `"NÃO INFORMADO"`?

### 2026-10-14 / De onde vêm os 2 s?

**Resumo técnico**

Não há atraso programado: o único `setTimeout` em `client.ts` é um teto de 15 s que aborta a chamada, não uma espera. A JUDIT também não documenta atraso proposital. Hipóteses abertas: compilação da rota no `next dev`, latência de rede/TLS ou demora da JUDIT. As linhas do terminal separam essas hipóteses.

**Perguntas de verificação** (respostas em "Perguntas e respostas")

- Qual a diferença entre um tempo limite (timeout) e um atraso (delay)?

### 2026-10-14 / CNJ fictício na allowlist e teste da compilação

**Resumo técnico**

`0000000-39.2026.8.26.0050` entrou na allowlist (`guard.ts`) com teste; 86 testes, lint, typecheck e format ok. Lacuna 10 mantida aberta. Teste gratuito: rota nunca compilada, sem chamar a JUDIT, levou 2,28 s e depois 0,014 s. Os 2 s são compilação do `next dev`, não da JUDIT (catálogo C10).

### 2026-10-14 / A rota está mal otimizada?

**Resumo técnico**

Não. O `next dev` compila cada rota no primeiro acesso (guia `local-development.md` do Next); o `next build` compila tudo antes. Já aquecida, a rota respondeu em 14 ms. Os 2 s são custo do ambiente de desenvolvimento, não do nosso código; em produção, o tempo relevante será o da JUDIT.

**Perguntas de verificação** (respostas em "Perguntas e respostas")

- Por que medir desempenho no `next dev` engana, e onde a medida faria sentido?

### 2026-10-14 / Desenho da fatia 3: híbrido datalake + request assíncrona

**Resumo técnico**

Decisão sua: não copiar processos para o MongoDB. A tela lê o datalake (`POST /lawsuits`) e, para dados frescos, dispara `POST /requests`. Lacuna: a documentação não diz que um request concluído atualiza o datalake, então o resultado novo é lido em `GET /responses`. Proposto guardar só o ponteiro (`request_id`).

**Perguntas de verificação** (respostas em "Perguntas e respostas")

- Por que guardar o `request_id` não é "replicar a JUDIT", mas guardar a lista de processos seria?

### 2026-10-14 / Fatia 3a: consulta ao datalake na página da empresa

**Resumo técnico**

Botão "Consultar datalake JUDIT" (modo `db`) chama `searchCompanyLawsuitsAction`, que valida o CNPJ, exige a empresa cadastrada e chama `searchLawsuits`. `fromJuditLawsuit` converte o processo para o modelo da tela. Nada é gravado. 99 testes, lint, typecheck e build ok; clique real ainda não testado.

**Perguntas de verificação** (respostas em "Perguntas e respostas")

- A server action recusa CNPJs fora da allowlist. Por que isso não basta para publicar o app com `JUDIT_LIVE_CALLS` ligado?
- Por que o mapeamento lê `classifications` de forma defensiva em vez de tipar o campo no schema Zod?

### 2026-10-14 / Encerramento da sessão

**Resumo técnico**

Log em `docs/logs/2026-10-14-sessao.md` e relatório atualizado. Branch `feat/judit-datalake` criada a partir da `main`, com dois commits (código da 3a e documentação), não enviada ao GitHub. Um commit é um retrato, não uma entrega: o que está pendente fica escrito na mensagem e no relatório.

**Perguntas de verificação** (respostas em "Perguntas e respostas")

- Como commitar um trabalho que ainda não terminou sem atrapalhar a `main`?

### 2026-10-14 / Onde está o diário?

**Resumo técnico**

O diário parecia ter 91 linhas porque uma aba do Cursor guardava, desde 12/10, uma edição acidental não salva, e por isso não recarregava o arquivo do disco. O arquivo real tem mais de 1200 linhas. Primeiro palpite errado: a cópia em `~/Downloads`. Caso D4 no catálogo.

**Perguntas de verificação** (respostas em "Perguntas e respostas")

- Por que o editor não atualizou a aba quando o arquivo mudou no disco?
- Se a aba antiga tivesse sido salva por cima, como recuperar o diário completo?

### 2026-10-14 / "Razão social indisponível" no modo `db`

**Resumo técnico**

Comportamento esperado. `ensureCompany` (`src/features/companies/db.ts`) cria a empresa só com o CNPJ (`legalName: null`), e nenhuma fatia busca dados cadastrais. O texto vem do cabeçalho em `company-detail.tsx`, não do botão do datalake. O resultado do clique ainda não foi relatado.

### 2026-10-14 / Teste manual da fatia 3a concluído

**Resumo técnico**

O clique em "Consultar datalake JUDIT" (modo `db`, CNPJ fictício) funcionou: a server action chamou `POST /lawsuits` e mostrou o resultado. Nova observação: a JUDIT aceitou o CNPJ **sem máscara** (`A1B2C3D4E5F668`). Fatia 3a validada de ponta a ponta. Próxima: 3b.

### 2026-10-14 / `on_demand`: custo por uso, não por funcionalidade

**Resumo técnico**

A JUDIT cobra por requisição. Ter `on_demand` no código não custa nada, só o envio com `true` custa. Docs: "força a busca em tempo real nos tribunais" (request-document) e "custo maior" (glossário), sem valores publicados. Proposta para a 3b: uma opção desmarcada por padrão e `onDemand` gravado em `judit_requests`.

**Perguntas de verificação** (respostas em "Perguntas e respostas")

- Por que gravar `onDemand` em cada request, se a JUDIT já sabe o que foi pedido?

### 2026-10-14 / Modalidades de consulta explícitas

**Resumo técnico**

Decisão sua: cada consulta e monitoramento deve declarar a modalidade JUDIT usada (endpoint, sync/async, datalake/tribunal, polling/webhook). Nada implícito, como uma caixa `on_demand` escondida. Os rótulos da interface ficam para depois. Proposta: um catálogo tipado de modalidades e um campo `mode` gravado. Aguardando aprovação.

### 2026-10-14 / Request assíncrona atualiza o datalake

**Resumo técnico**

Você confirmou que uma request assíncrona concluída atualiza o datalake da JUDIT (fonte: tech lead da JUDIT). Isso reforça o desenho híbrido: depois da request, um `POST /lawsuits` barato já lê dado fresco, sem cópia no MongoDB. Banco próprio de processos só compensa com muitas consultas repetidas. A atualização chega junto com a entrega (também confirmado).

**Perguntas de verificação** (respostas em "Perguntas e respostas")

- Que sinal, no uso real, indicaria que chegou a hora de guardar processos no próprio banco?

### 2026-10-14 / Mapa da estrutura do projeto

**Resumo técnico**

Três camadas: `src/lib/judit` (como chamar cada endpoint, sem decisões de produto), `src/features/<domínio>` (regras, persistência, actions, mapeamento) e `src/app` (páginas e rotas de dev). `src/lib/data.ts` escolhe demo ou MongoDB. O catálogo de modalidades ficaria entre features e o client.

**Perguntas de verificação** (respostas em "Perguntas e respostas")

- Por que `searchCompanyLawsuitsAction` confere o modo, o CNPJ e a empresa, se o botão só aparece quando tudo isso já está certo?
- Em qual pasta entra uma decisão como "esta consulta é `historical_on_demand`", e por que não em `src/lib/judit`?

### 2026-10-14 / Fatia 3b: consultas assíncronas com modalidade explícita

**Resumo técnico**

Catálogo `modes.ts`, coleção `judit_requests` (índice único em `requestId`) e duas actions: criar a consulta (comum ou on-demand, com `cache_ttl_in_days`) e verificar o status e as respostas. O `request_id` vai para o log antes de gravar. 111 testes, lint, typecheck, format e build passando. Falta o teste manual.

**Perguntas de verificação** (respostas em "Perguntas e respostas")

- Por que `checkAsyncQueryAction` procura o `request_id` no nosso banco antes de perguntar à JUDIT?
- Por que o `request_id` é registrado no log antes de ser gravado no MongoDB?

### 2026-10-14 / Revisão da fatia 3b

**Resumo técnico**

Você revisou o código da 3b e aprovou sem pedir mudanças. Ainda pendente: o teste manual com a JUDIT (reiniciar o `pnpm dev` antes, para criar o índice de `judit_requests`) e o commit.

### 2026-10-14 / Teste manual da fatia 3b concluído

**Resumo técnico**

Teste manual feito por você com o CNPJ fictício: criar, verificar status e ler o resultado funcionaram. Com isso, a JUDIT também aceitou o CNPJ sem máscara em `POST /requests`. Fatia 3b validada de ponta a ponta; falta o commit.

### 2026-10-14 / Encerramento da etapa 3

**Resumo técnico**

Textos da consulta síncrona sem "datalake", usando o rótulo do catálogo. Etapa 3 concluída: consulta síncrona e assíncrona (comum e on-demand), testadas com a JUDIT real. Relatório e log atualizados. Próxima sessão: merge da branch e desenho da etapa 4, monitoramento real com cobrança recorrente.

### 2026-10-14 / Desenho da etapa 4: proposta

**Resumo técnico**

Proposta para o monitoramento real: modalidades explícitas (`tracking_document` e `tracking_lawsuit`), reserva no MongoDB antes do `POST /tracking` para impedir monitoramento duplicado (cobrança recorrente em dobro), status e resultados verificados à mão, pausa disponível desde a primeira fatia. Aguardando decisões.

**Perguntas de verificação** (respostas em "Perguntas e respostas")

- Por que desligar `JUDIT_LIVE_CALLS` não interrompe a cobrança de um monitoramento ativo?

### 2026-10-14 / Etapa 4: monitoramento real implementado

**Resumo técnico**

Monitoramento real com reserva no MongoDB antes do `POST /tracking`, envio atômico, classificação do erro (`failed` libera o CNPJ, `uncertain` bloqueia), `mode` explícito, pausar, reativar, excluir com confirmação e resultados. 123 testes, lint, typecheck, format e build passando. Falta o teste com a JUDIT, que atravessa 24 h.

**Perguntas de verificação** (respostas em "Perguntas e respostas")

- Por que aqui a reserva vem antes da chamada à JUDIT, se na 3b a chamada vinha antes da gravação?
- Por que um timeout mantém o CNPJ bloqueado, mas um HTTP 400 o libera?

### 2026-10-14 / Teste da etapa 4 pelo agente: bloqueado

**Resumo técnico**

O agente subiu o `pnpm dev` e conferiu, sem custo: a página `/monitoramentos` mostra o registro da etapa 2 como "Não enviado à JUDIT" (recorrência diária) e as oito actions existem. A chamada às actions foi bloqueada pelo classificador do modo automático (caso D3). O teste segue com você.

### 2026-10-14 / Teste real da etapa 4 (passos 2 a 4)

**Resumo técnico**

Você rodou as actions pelo terminal: reserva antiga descartada; monitoramento criado na JUDIT (`tracking_id c8ac8528…`, primeira execução às 6h, CNPJ sem máscara aceito); duplicata recusada em 47 ms sem chamar a JUDIT. Divergência: pedimos recorrência 30 e a JUDIT gravou 1 (caso C11).

### 2026-10-14 / Teste do `PATCH /tracking`

**Resumo técnico**

`PATCH` com `{ "recurrence": 30 }` no monitoramento de teste: a JUDIT respondeu 400, `"unrecognized key: 'recurrence'"`. O OpenAPI estava certo (contradição 26) e o corpo de erro veio aninhado, com `data` (lacuna 1). A recorrência não muda depois de criada; o monitoramento continua diário até ser pausado.

### 2026-10-14 / `PATCH` passa a enviar `callback_url`

**Resumo técnico**

`updateTrackingRecurrence` virou `updateTrackingCallbackUrl` (`src/lib/judit/tracking.ts`), seguindo o OpenAPI. A rota de dev aceita só `{ callbackUrl }` com `https://` e recusou localmente `recurrence` e uma URL `http`. Será usada na etapa 5, para apontar o webhook de um monitoramento para o nosso endpoint. 123 testes passando.

### 2026-10-14 / Revisão técnica e encerramento da sessão

**Resumo técnico**

Revisão do dia no relatório (18 itens). Os urgentes: `next dev` exposto na rede, estado duplicado dos monitoramentos, chamada dupla em desenvolvimento e `uncertain` sem conferência. Caso C10 revisto. Novas perguntas de entrevista sobre as etapas 3 e 4. Commits na `feat/judit-tracking`; falta pausar o monitoramento.

**Perguntas de verificação** (respostas em "Perguntas de entrevista sobre este repositório")

- Por que o `refresh()` não atualiza a lista de monitoramentos na tela?
- Por que buscar dados num `useEffect` é arriscado com uma API cobrada?

### 2026-10-14 / Onde estamos

**Resumo técnico**

Etapas 1–3 na `main`; etapa 4 na `feat/judit-tracking`, não enviada. Às 22h33 (BRT), a primeira execução do monitoramento de teste ainda não tinha ocorrido. Ordem: conferir e pausar, corrigir os itens 1–3 da revisão, abrir o PR e definir com a JUDIT o cadastro do webhook (etapa 5).

### 2026-10-14 / `next dev` só em `127.0.0.1` e seção "Inside knowledge"

**Resumo técnico**

Script `dev` agora é `next dev -H 127.0.0.1` (item 1 da revisão). Verificado: socket em `127.0.0.1:3000`, `curl` local 200, pelo IP da rede recusado. Nova seção "Inside knowledge" (IK0–IK9): dúvidas sobre o funcionamento interno da JUDIT, respondidas por você.

**Perguntas de verificação** (respostas em "Perguntas e respostas", seção "Rede do servidor de dev")

- Qual a diferença entre escutar em `0.0.0.0` e em `127.0.0.1`?
- Por que um túnel para o webhook (etapa 5) continua funcionando com `-H 127.0.0.1`?

### 2026-10-14 / Pontas soltas da etapa 4

**Resumo técnico**

Corrigidos os itens 2, 3, 4, 6, 7, 11 e parte do 17 da revisão: lista do servidor sem cópia, resultados buscados no clique, "Conferir na JUDIT", `try/catch` nos handlers, aviso de recorrência, funções do banco renomeadas e mais testes. 131 testes, lint, typecheck, build. Navegador não testado.

**Perguntas de verificação** (respostas em "Perguntas e respostas", seção "Pontas soltas da etapa 4")

- Por que, se nada for encontrado, a conferência volta a reserva para pendente em vez de liberar o CNPJ?
- Por que a conferência espera 2 minutos depois do envio?
- Depois da correção do item 2, quem atualiza a linha da tabela quando você pausa um monitoramento?

### 2026-10-14 / Commits das pontas soltas

**Resumo técnico**

Três commits na `feat/judit-tracking`, sem envio ao GitHub: `98085dc` (servidor de dev só local), `6e52e0a` (pontas soltas da etapa 4) e o de documentação (relatório, log da sessão e diário). Daqui em diante, o agente só acrescenta texto a este diário, sem alterar o que já está escrito.

### 2026-10-15 / Seção única de explicação

**Resumo técnico**

A pedido, removidas as 72 seções "Minha explicação em palavras próprias" que só tinham o placeholder, e a do "Modelo de entrada". O texto já escrito foi movido, sem alteração, para a seção única perto do topo, que só você escreve. A seção 4 de `AGENTS.md` e `docs/AGENTS.md` descreve a nova regra.

### 2026-10-15 / Auditoria / client.ts

**Resumo técnico**

Auditado na conversa do Claude (chat), fora deste repositório. `juditRequest` (`src/lib/judit/client.ts:61`) é a única porta para a JUDIT. Pontos discutidos:

- sem novas tentativas automáticas: a JUDIT não documenta chave de idempotência, então repetir um `POST` que ela já recebeu poderia criar e cobrar em dobro;
- três hosts separados (requests, tracking e lawsuits), montados em `buildUrl`;
- `acceptErrorBody`: deixa o serviço aceitar um corpo de erro como resultado, caso do 404 com `has_lawsuits: false` em `POST /lawsuits`;
- o kill switch (`assertLiveCallsEnabled`) roda antes de ler a chave;
- tempo limite com `AbortController`; a flag `timedOut` separa o nosso timeout (`JuditTimeoutError`) de uma falha de rede (`JuditNetworkError`), e o corpo também é lido dentro do prazo;
- a árvore de decisão da resposta é a tabela C do catálogo;
- HTTP 200 não é sucesso de negócio: `findApplicationError` procura o `application_error`;
- o 429 é separado (`JuditRateLimitError`), com `Retry-After` e `X-RateLimit-*` guardados como vieram;
- schema tolerante: campos novos não quebram a validação;
- auxiliares: `toHttpError` (corpo de erro aninhado ou plano), `parseJson` com o `Symbol` `INVALID_JSON` para JSON inválido, e `redact`, que tira a chave de qualquer texto de erro.

### 2026-10-15 / Modo auditoria adiado

**Resumo técnico**

A auditoria completa do código passou para o fim do projeto, depois da etapa 7. As regras e a ordem dos arquivos estão no `AGENTS.md`, seção 6, "Modo auditoria". Até lá, o trabalho segue o modo padrão (construir e ensinar).

### 2026-10-15 / Primeira execução do monitoramento e pausa

**Resumo técnico**

O agente conferiu o monitoramento de teste pelas rotas de dev e pela action "Ver resultados". A execução rodou às 06:55 UTC e terminou sem resultados, o que é correto para a modalidade. O monitoramento está pausado na JUDIT e no MongoDB. Etapa 4 encerrada.

**O que o teste mostrou**

- Pausa: `pauseTrackingAction` às 21:58 UTC. A JUDIT devolve `status: "paused"` com `paused_at`, e o MongoDB também registra `paused`. As execuções diárias param por aqui.
- Execução: uma request com `origin: "tracking"`, criada às 06:55:25 UTC e concluída às 07:01:07 UTC (quase 6 minutos), com `responses_count: 0`.
- Zero resultados é o esperado: a JUDIT gravou o filtro `distribution_date_gte` igual à data de criação do monitoramento, porque o monitoramento por documento só avisa processos novos (catálogo, C14).
- Formato de data (item 14 da revisão): `GET /responses/tracking` aceitou `2026-10-14T00:00:00`, o formato que a tela usa, e também o ISO com `Z`. O formato dos campos das respostas continua sem verificação, porque não houve resposta.
- A JUDIT devolve o CNPJ com máscara (`A1.B2C.3D4/E5F6-68`), embora tenhamos enviado sem. A conferência do envio incerto (C12) já compara a chave normalizada.
- Campos fora da documentação: `execution_minute`, `updating_at`, `plan_config_type`, `tracked_items_count`, `origin_created_at` e `tags.ip`, o IP de quem criou o monitoramento. É dado pessoal: não deve ir para log nem para o banco.
- Chamadas feitas pelo agente: 5 leituras na JUDIT (`GET /tracking`, dois `GET /responses/tracking`, `GET /requests/{id}` e `GET /responses`), todas do monitoramento fictício.
- Não verificado: no navegador, se "Ver resultados" gera uma chamada só (item 3); a chamada de hoje foi feita por `curl`.

**O que isso significa**

- Para o produto: monitorado, o CNPJ fictício nunca vai gerar um webhook. A etapa 5 precisa de outro gatilho para o teste real.
- Para o suporte: um monitoramento "vazio" não é defeito, e todo diagnóstico começa por identificar o tipo de ID (C15).
- O que foi observado entrou nos itens IK2, IK4, IK5 e IK9 de "Inside knowledge"; as respostas continuam com você.

### 2026-10-15 / Etapa 5 explicada

**Resumo técnico**

Explicação da etapa 5 antes de codar: a JUDIT passa a chamar o app (webhook) em vez de o app perguntar (polling). Fluxo, contrato documentado (`response_created`, entregas incrementais, fim com código 600, 2xx em 10 s, sem assinatura) e quatro decisões pendentes: túnel, proteção da rota, gatilho do teste e o que gravar.

### 2026-10-15 / Etapa 5: receber e gravar webhooks

**Resumo técnico**

Nova rota `POST /api/webhooks/judit`: confere o token da `callback_url`, valida o envelope, grava em `webhook_events` (pendente) e responde 200, ou 503 para a JUDIT repetir. Dado de processo resumido por padrão; modo manutenção grava tudo. `src/proxy.ts` limita o túnel à rota do webhook.

**Decisões (2026-10-15)**

- Túnel: `cloudflared`, já instalado; ligado só durante o teste.
- Proteção: token secreto na `callback_url` (`JUDIT_WEBHOOK_TOKEN`), comparado em tempo constante. A JUDIT não documenta assinatura.
- Gatilho do teste real: consulta assíncrona do CNPJ fictício com `callbackOrigin`, porque o monitoramento por documento nunca gera evento (C14).
- O que gravar: envelope completo; `response_data` de processo vira resumo (CNJ e nomes dos campos); `JUDIT_WEBHOOK_FULL_PAYLOAD=enabled` grava tudo para diagnóstico.

**Como verificar**

- 180 testes (eram 131): envelope, token, client (mascaramento), banco em memória (inclusive o exemplo com `$oid` e duas reentregas simultâneas), contrato HTTP da rota e o filtro do túnel. Lint, typecheck, formatação e build passando.
- No `pnpm dev`: local responde 200; com `Host` do túnel ou cabeçalho `cf-ray`, 404 (F5). A rota do webhook respondeu 503 no servidor que já estava rodando, e 404 no build novo (D6); falta reiniciar o `pnpm dev`.
- Ainda não verificado: uma entrega real da JUDIT pelo túnel.

**Perguntas de verificação** (respostas em "Perguntas e respostas", seção "Webhooks")

- Por que a rota responde 503, e não 500 ou 400, quando o MongoDB está fora do ar?
- Se o token só serve para provar a origem, por que ele precisa ser mascarado no banco?

### 2026-10-15 / Teste real do webhook

**Resumo técnico**

Primeira entrega real da JUDIT pelo túnel: uma consulta assíncrona do CNPJ de teste com `callbackOrigin` gerou duas entregas, gravadas como pendentes, com o token mascarado. O filtro do túnel funcionou pela internet. Túnel encerrado ao final.

**O que o teste mostrou**

- Linha do tempo (UTC): consulta criada às 22:54:25.6; entrega do processo gravada às 22:54:28.3 (2,7 s); entrega de fim (`application_info`, código 600, `REQUEST_COMPLETED`) às 22:54:32.3 (6,7 s).
- A hipótese do gatilho estava certa: uma consulta assíncrona com `callback_url` dispara entregas na hora, sem cadastro com o suporte (IK9).
- Só veio a entrega do cache (`cached: true` e `tags.cached_response: true`), sem uma segunda "atualizada": a consulta por documento sem `on_demand` não vai ao tribunal (README, item 35). A documentação prevê esse caso.
- O indicador de cache, numa entrega, aparece em dois lugares: `payload.cached` e `payload.tags.cached_response` (README, item 19).
- Campos fora da documentação: `responseIds` no `payload`, `savedResponseId` dentro do processo e `user_id` repetido dentro do `payload`.
- O processo veio resumido como planejado: o CNJ fictício e 33 nomes de campos, sem partes nem valores.
- A JUDIT ecoou a `callback_url` também na resposta 201 de criação; o client já a mascarou (F4).
- Pela internet, só a rota do webhook respondeu; o resto, 404 (F5).
- Não verificado: reentrega real (a JUDIT só reenvia se a rota falhar) e entregas de monitoramento.

**O que conferir no seu terminal**

As linhas `[webhooks] recebido: callback_id=…` das duas entregas, e nenhuma linha `POST /api/webhooks/judit?token=…` (o `next.config.ts` tira essa rota do log de requisições).

### 2026-10-15 / Decisões das etapas 6 e 7 em discussão

**Resumo técnico**

Revisão das seis decisões de `docs/plano-etapas-6-7.md`. Códigos 700 a 703 confirmados na documentação. Achados: "um alerta por monitoramento e CNJ" não serve para monitoramento por CNJ; as duas entregas reais serão `ignored` (a rota de dev não grava em `judit_requests`). Decisões aguardando o usuário.

### 2026-10-15 / Etapa 7 como etapa de produto

**Resumo técnico**

Proposta do usuário: a etapa 6 completa o back-end; a 7 vira etapa de produto (usar o app, repensar fluxos). Contraproposta: a parte técnica da 6c (enviar `callback_url`) fica na 6, para um teste de ponta a ponta; a lista da 7 fecha depois do uso guiado.

### 2026-10-15 / Etapa 6: processamento, alertas e diagnóstico

**Resumo técnico**

Etapa 6 implementada em quatro fatias e quatro commits na branch `feat/judit-webhook-processing`. Cada entrega gravada é processada depois do 200 (`after()`): associa à consulta ou ao monitoramento, atualiza o estado e cria o alerta sem duplicar. As telas `/webhooks` e `/alertas` leem o banco.

**Decisões (2026-10-15, todas aprovadas pelo usuário)**

- A etapa 6 completa o back-end. A etapa 7 vira a etapa de produto: usar o app e repensar os fluxos, com a lista fechada depois desse uso.
- O vocabulário da JUDIT continua na interface ("consulta síncrona", "assíncrona", "on-demand"): mostra que as modalidades foram entendidas.
- Processamento com `after()`, reserva atômica (`pending → processing`) e "Reprocessar".
- `application_error` numa consulta não muda o status dela (IK7).
- Alerta com `dedupeKey` e índice único: por processo no monitoramento por documento, por entrega nos demais.
- Webhook só nas consultas assíncronas, com `JUDIT_WEBHOOK_PUBLIC_ORIGIN`; os monitoramentos continuam em polling (a URL do túnel muda a cada execução).

**Fatias**

- 6a (`process.ts`, `delivery.ts`): regras do processamento. `delivery.ts` lê o que a JUDIT disse (contrato); `process.ts` decide o que fazer (nossas regras).
- 6b: telas lendo o MongoDB, "marcar como lido" gravado, "Reprocessar" e contador real de reentregas. Sem mudar layout.
- 6c: `callback_url` nas consultas do card, quando há origem pública; entregas que chegam antes de a consulta ser gravada são processadas logo depois.
- 6d: "Verificar status" não pergunta à JUDIT quando já está `completed` (C16); nova consulta igual é recusada enquanto há uma em aberto (G5).

**Como verificar**

- 219 testes (eram 180), lint, typecheck, formatação e build. As regras foram testadas contra um MongoDB em memória, com os exemplos da documentação.
- Fumaça no `pnpm dev` que já estava rodando: `/webhooks` e `/alertas` responderam 200 lendo o Atlas, com as duas entregas reais da etapa 5 em `pending`.
- Não verificado: o índice `alerts_dedupe_key_unique` no Atlas (precisa reiniciar o `pnpm dev`, G4), o processamento das duas entregas reais (esperado: "ignorado", G1) e uma consulta do card com webhook pelo túnel.

**Perguntas de verificação** (respostas em "Perguntas e respostas", seção "Webhooks")

- Por que o processamento roda depois do 200, e não antes?
- O mesmo processo chega duas vezes por um monitoramento por documento: o que impede dois alertas, e por que essa regra não serve para o monitoramento por CNJ?

### 2026-10-15 / Teste manual da etapa 6

**Resumo técnico**

Teste feito pelo agente, a pedido do usuário. Depois do `pnpm dev` reiniciado, as entregas antigas ficaram `ignored` (G1). Uma consulta assíncrona real, criada pela action do card com o túnel ligado, foi concluída pelo webhook (código 600) em 5,5 s, sem "Verificar status" e sem alerta.

**O que foi feito e o que apareceu**

- `pnpm dev` reiniciado pelo usuário às 20:36:09. A primeira leitura do banco passou pelo `ensureIndexes` sem erro: o índice `alerts_dedupe_key_unique` foi criado. A confirmação é indireta: um índice recusado derrubaria a conexão. Não foi aberto o Atlas.
- "Reprocessar" chamado como o botão faria (server action pelo `curl`, sem chamada à JUDIT): as duas entregas antigas ficaram `ignored`, em cerca de 140 ms cada.
- Túnel `cloudflared` ligado; pela internet, `/` e `/webhooks` responderam 404 e o webhook sem token, 401 (F5).
- `JUDIT_WEBHOOK_PUBLIC_ORIGIN` posta no `.env.local` pelo usuário; o `next dev` releu o arquivo sem reiniciar.
- Consulta `historical_async` do CNPJ fictício pela action do card (1 consulta gasta): gravada com `delivery: "webhook"` às 23:38:36.663 (UTC).
- Linha do tempo: processo recebido às 23:38:38.434 (1,8 s depois da gravação), processado em 134 ms, sem alerta; código 600 recebido às 23:38:42.136, processado em 166 ms, com a nota "Consulta marcada como concluída".
- Na página da empresa: status `completed`, `updatedAt` às 23:38:42.306 (o webhook) e `lastCheckedAt` nulo (ninguém perguntou à JUDIT). Nenhum alerta criado.
- Túnel desligado ao fim (a URL passou a responder 530).

**Não verificado**

- Recusa de uma segunda consulta igual em aberto (G5): exigiria gastar outra consulta; está coberta pelos testes.
- Entregas de monitoramento (C14, IK11) e a ordem "entrega antes da gravação" (G1, segundo caso): a gravação veio 1,8 s antes da primeira entrega.

### 2026-10-15 / Proposta da etapa 8

**Resumo técnico**

Proposta do usuário: uma etapa 8 para "fechar" o projeto. A 8A deixa o repositório reproduzível por quem clona, com as pontas soltas resolvidas. A 8B é a auditoria, com o usuário ditando o que entendeu para o diário. Avaliação do agente: boa ideia, com a 8A antes da 8B e um critério de pronto testável. Registrada em `docs/plano-etapas-6-7.md`.

### 2026-10-15 / Etapa 8: níveis de execução

**Resumo técnico**

Etapa 8 refinada: a 8A pega os itens médios e baixos da revisão que ficaram abertos; a 8B audita e anota; a 8C corrige o que a auditoria anotou. O ditado vira texto fluido, com as ideias do usuário. Em aberto: como rodar sem a chave da JUDIT e sem o Atlas.

**O que já existe no repositório (fato)**

- O pacote `mongodb` é o driver: a biblioteca que conversa com um banco. Ele não é um banco. Quem clona o projeto não tem acesso ao seu cluster do Atlas (a senha está no seu `.env.local`, e não deve ser compartilhada).
- O `mongodb-memory-server` (só para desenvolvimento) baixa o programa oficial do MongoDB (`mongod`) e sobe um servidor temporário nesta máquina. Hoje só os testes o usam.
- Sem `.env.local`, `DATA_SOURCE` vale `demo`: nada chama o banco nem a JUDIT. Hipótese a confirmar no clone limpo: a demonstração roda sem nenhuma variável.

**Níveis propostos (decisão pendente)**

1. Demonstração: `pnpm install` e `pnpm dev`, sem configurar nada.
2. Banco sem JUDIT: um MongoDB próprio, local (um script com o `mongodb-memory-server`, sem instalar nada) ou no Atlas. Empresas e reservas de monitoramento funcionam; o que depende da JUDIT avisa que a chave não está configurada.
3. JUDIT real: chave própria, kill switch, allowlist e túnel.
4. Opcional, mais caro: uma "JUDIT simulada", que responde com os exemplos da documentação (`src/lib/judit/__fixtures__`) e dispara webhooks falsos. Daria o fluxo inteiro sem chave e serviria de base para a fase 2 (ambiente de treino com falhas injetadas).

**Recomendação do agente:** nada de cair na demonstração sozinho quando falta a chave. Uma troca silenciosa já confundiu antes (catálogo, A2). O modo continua explícito, e a tela diz o que falta.

### 2026-10-15 / Etapa 8: JUDIT gravada

**Resumo técnico**

Ideia do usuário: sem chave da JUDIT, o app entra em demonstração e reproduz respostas reais gravadas nos testes, mostrando quais CNPJs têm dados. Juntada ao nível 4 ("JUDIT simulada"). Todos os níveis entram na 8A. Gravações de CNPJs reais ficam fora do Git até o IK12.

**Por que juntar as duas ideias**

- É o mesmo mecanismo (gravar e reproduzir), com duas fontes de gravação: as respostas reais dos testes e os exemplos da documentação.
- A demonstração de hoje (`mock-data.ts`) não passa pelo código de verdade. Com a JUDIT gravada, a demonstração roda as actions, o banco e o processamento de webhooks. Ela vira um teste do produto, e não uma maquete.
- A tela dizer "você está em demonstração; CNPJs com dados gravados: …" deixa o modo explícito, o que resolve a objeção da troca silenciosa (A2).

**O cuidado**

- Gravar CNPJs reais grava processos com nomes e documentos de terceiros (partes, advogados, trabalhadores em ações trabalhistas). Num repositório público, isso é publicar dados pessoais. Além disso, os dados são o produto da JUDIT, e a documentação pública não diz se podem ser republicados (IK12).
- Por isso, só vão para o Git as gravações do CNPJ fictício e os exemplos da documentação. As gravações de CNPJs reais ficam nesta máquina.

### 2026-10-15 / Demonstração com dados reais criptografados?

**Resumo técnico**

O usuário propôs publicar os dados reais criptografados, com uma senha entregue a quem testa. O agente recomendou não fazer: o histórico do Git é irrevogável, dar a senha é compartilhar dado pessoal, e o custo não ensina nada sobre a JUDIT. Proposta: 8A só com os níveis 1 a 3, a JUDIT gravada na fase 2. Decisão pendente.

### 2026-10-15 / Dois produtos: protótipo e app real

**Resumo técnico**

Decisão do usuário: separar os produtos. No fim da etapa 7, o protótipo é atualizado com o visual novo e dados fictícios, e fica congelado. O app real exige banco e chave da JUDIT; o modo demonstração sai do `main` na 8A. O objetivo é que nenhum dos dois tenha um fluxo confuso.

**Condições propostas pelo agente**

- O protótipo é uma cópia tirada uma vez, no fim da etapa 7, e não é mantido em paralelo. Mantê-lo dobraria cada mudança de tela.
- Sem configuração, o app real mostra o que falta (como o `pnpm env:check`, mas na tela), em vez de quebrar.
- A remoção acontece na 8A, depois da cópia, porque a etapa 7 ainda usa os mesmos componentes para gerar o protótipo novo. De quebra, a auditoria (8B) fica com cerca de 1.600 linhas a menos.

### 2026-10-15 / Produto terminado na etapa 7; etapa 8 opcional

**Resumo técnico**

Decisão do usuário: o produto termina na etapa 7, apresentável, e a etapa 8 (8A, 8B, 8C) fica opcional para depois. O fechamento (README, clone limpo, tag) foi para a 7; o protótipo v0.2 vira a própria tag. `AGENTS.md`, seção 6, atualizado, inclusive com a regra do ditado.

### 2026-10-15 / Correção: dois produtos separados no fim da etapa 7

**Resumo técnico**

Correção do usuário à entrada anterior: o protótipo não vira uma tag do `main`. Ao terminar a revisão visual da etapa 7, saem dois produtos: o protótipo, à parte, só com dados fictícios e o código necessário para eles; e o `main`, reduzido ao app real, sem código de demonstração. A 8A ficou só com os itens abertos da revisão.

**Erro do agente:** o usuário já tinha decidido "dois produtos", e o agente trocou a decisão por uma tag sem perguntar. `AGENTS.md` e plano corrigidos.

### 2026-10-15 / Preparação da etapa 7

**Resumo técnico**

`main` local igual ao GitHub (`b3b727d`, merge do PR #6). Criada a branch `feat/product-review`, com um commit das decisões sobre as etapas 7 e 8 (`AGENTS.md`, plano, diário e relatório). Próxima sessão: uso guiado do app. Reiniciar o `pnpm dev` não é necessário.

### 2026-10-15 / Uso guiado: roteiro e primeiras anotações

**Resumo técnico**

Criado `docs/etapa-7-uso-guiado.md`: oito tarefas em duas rodadas e as anotações ditadas, com respostas. Achados: busca do topo só olha o banco; Configurações tem "Não configurado" fixo; busca por nome existe na JUDIT, mas a allowlist barra; menu sem dados cadastrais, mandados, DJEN. Proposta: ícone "i".

### 2026-10-15 / Uso guiado: textos fixos do protótipo

**Resumo técnico**

O app não estava em modo demo: o selo do cabeçalho diz "Banco de dados". A sensação vinha de textos fixos da etapa 1 (dica do selo, perfil, Configurações, busca, visão geral, "Exemplos fictícios" sobre dados reais). Inventário em `docs/etapa-7-uso-guiado.md`. Regra: texto que descreve estado deve ser calculado.

### 2026-10-15 / Uso guiado: alertas e notificação externa

**Resumo técnico**

Dois pontos ditados, registrados no guia da etapa 7 para a discussão final: alertas dentro de Monitoramentos, porque só eventos de monitoramento geram alerta (`process.ts:41-51` confirma); e um evento de saída não usado no back-end, para ilustrar uma notificação externa (o "macho da tomada").

### 2026-10-15 / Etapa 7: círculo 1 do escopo

**Resumo técnico**

Fim do uso guiado. 16 pontos reunidos em `docs/etapa-7-escopo.md`, com 11 considerações e 13 escolhas (C1-1 a C1-13). Fatos: menu recolhível já existe (Ctrl+B); a JUDIT monitora CPF, mas não há CPF de teste (IK13). Ideia central: webhook é canal, não coisa.

### 2026-10-15 / Etapa 7: decisões do círculo 1 e fatia C1-13

**Resumo técnico**

Decisões: as recomendadas, com um dashboard geral de verdade (C1-8). Fatia C1-13: Configurações calcula no servidor a situação de cada integração (`settings/status.ts`, `hasServerEnv`), sem valores; textos falsos do modo `db` corrigidos; "Sem login" no perfil. 227 testes, lint, tipos, formato e build ok.

### 2026-10-16 / Etapa 7: círculo 1 implementado

**Resumo técnico**

Todas as escolhas do círculo 1 implementadas, sem commit: vista de suporte, menu por tarefa, alertas dentro de Monitoramentos, página Consultas (coleção nova `sync_queries`, só metadados), adicionar empresa com dados cadastrais, Dashboard com gráficos, ajuda "i" e evento de saída sem destino. 252 testes, lint, tipos, formato e build ok.

### 2026-10-16 / Menu recolhido e proposta de pessoas físicas

**Resumo técnico**

Menu lateral recolhido por padrão, só ícones, com "Expandir menu" acima de Configurações; no celular, o botão do cabeçalho continua. Proposta ditada: todos os identificadores da JUDIT (CPF, CNPJ, CNJ...), reabrindo a C1-5. Escolhas R1 a R6 em `docs/etapa-7-escopo.md`, pendentes.

### 2026-10-16 / Tomadas do back-end (círculos 3 ou 4)

**Resumo técnico**

Proposta ditada e registrada para os círculos 3 ou 4: o repositório como base para clientes, com pontos de extensão prontos no back-end ("tomadas macho"), a começar por um login de exemplo que avisa não proteger nada. Nada implementado. Notas em `docs/etapa-7-escopo.md`.

### 2026-10-16 / Etapa 7: círculo 2, fatias 1 a 10

**Resumo técnico**

Proteções de custo, partes (CNPJ e CPF) com migração, abas Empresas e Pessoas, página Consultar guiada pelo catálogo de features, barra de pesquisa, monitoramento por CPF e por termos, conta na JUDIT, processo no modo `db`, pormenores do círculo 1 e consultas assíncronas novas (processo por CNJ com resumo por IA, mandados, execução penal). Uma fatia por commit; nada testado ao vivo.

### 2026-10-16 / Etapa 7: círculo 2, pormenores da fatia 11

**Resumo técnico**

Vista de suporte num cookie, lido pelo servidor no modo `db` (a página nasce certa); adicionar parte na demonstração (só na aba); paginação de 25 linhas com aviso de limite; leituras dentro do `<Suspense>` (D5); um só `<main>` por página (J2). 317 testes, lint, tipos, formato e build ok.

### 2026-10-16 / Conferência de entregas perdidas (IK10)

**Resumo técnico**

Ao abrir o resultado de uma consulta com entrega por webhook, a vista de suporte compara as respostas listadas pela JUDIT com as entregas gravadas para o mesmo `request_id`, sem chamada nova. A relação "uma resposta, uma entrega" é hipótese nossa (catálogo G7).

### 2026-10-16 / Retomada: o que o círculo 2 implementou

**Resumo técnico**

Retomada pela seção "Como retomar com o agente" do relatório de progresso. Revisão das 14 fatias do círculo 2 (`4d49f2f` a `f7c9028`), a partir de `docs/etapa-7-escopo.md`. Nada alterado no código; próximo passo continua sendo testar ao vivo as chamadas novas.

### 2026-10-17 / Retomada: resumo da etapa 7

**Resumo técnico**

Resumo da etapa 7 a partir do relatório, do escopo e do diff local: uso guiado, círculo 1 (forma geral), círculo 2 (14 fatias). Sem commit: três testes ao vivo de 2026-10-16 (dados cadastrais, `step_terms`, saldo 422). Faltam três testes ao vivo, decisões do usuário e o fechamento.

### 2026-10-17 / Teste ao vivo: consulta processual com resumo por IA

**Resumo técnico**

`lawsuit_async` com resumo por IA no CNJ fictício: aceito (`judit_ia` devolvido), segunda chamada barrada pela regra de consulta em aberto. A de ontem concluiu em cerca de 16 minutos, mas o app mostrava "Na fila" (catálogo K3, README 46). Duas leituras de status feitas, de custo desconhecido.

### 2026-10-17 / Círculo 3, ponto 1: Consultar para leigos

**Resumo técnico**

Ditado registrado em `docs/etapa-7-escopo.md` ("Círculo 3: anotações"): reconhecer o identificador pela digitação e fazer de Consultar a entrada do leigo, com escolha entre consulta única e monitoramento. Devolução do agente: o reconhecimento já existe em parte; custo e entradas sobrepostas pesam.

### 2026-10-17 / Círculo 3, ponto 2: duas páginas, uma função cada

**Resumo técnico**

Ditado registrado: círculo 3 define o fluxo do cliente, com Pesquisar (consultar ou monitorar) e uma página de leitura do que foi recebido. Devolução: monitoramento não devolve o retrato atual (C14), nem todo dado se monitora, webhook depende de URL pública, e a leitura exige decidir se resultados são gravados.

### 2026-10-17 / Círculo 3, ponto 3: digitar uma vez e a barra de pesquisa

**Resumo técnico**

Ditado registrado: consultar e monitorar sem redigitar (secundário); Consultar só com o campo; a barra de pesquisa sai de Consultar e vira busca de consultas já feitas, com "criar consulta" discreto; vista de suporte fica para o círculo 4. Reabrir consulta síncrona depende de gravar resultados.

### 2026-10-17 / Círculo 3: proposta consolidada

**Resumo técnico**

Pontos 1 a 3 reunidos em `docs/etapa-7-escopo.md`: o que foi dito por tema, crítica, decisões D0 a D7 e sete fatias. Achado na documentação: exemplos de OAB discordam e o RJI tem 20 dígitos como o CNJ (README 47). Decisão mais pesada: gravar ou não os resultados.

### 2026-10-17 / Círculo 3: decisões D0 e D1, navegação no topo

**Resumo técnico**

Decidido: allowlist desligada pelo `.env.local` (limites por minuto e diário continuam) e gravar tudo normalizado no MongoDB, revertendo o desenho híbrido da etapa 3. Navegação vira barra no topo com duas páginas; barra de pesquisa em todas. RJI e OAB sem formato documentado (IK15).

### 2026-10-17 / Allowlist desligada

**Resumo técnico**

O usuário pôs `JUDIT_ALLOWLIST=disabled` no `.env.local`; `pnpm env:check` confirma. Os limites ficam no padrão (30 por minuto, 50 por dia), porque as variáveis estão vazias. Falta reiniciar o `pnpm dev`, o que também roda a migração para `parties` (I1).

### 2026-10-17 / Círculo 3: plano de implementação

**Resumo técnico**

Nove fatias em `docs/etapa-7-escopo.md`: reconhecimento de identificadores, catálogo ampliado, navegação no topo, Consultar nova, base própria, Minhas informações, barra unificada, webhook nos monitoramentos, limpeza e demonstração. Relatório de progresso atualizado com o prompt de retomada.

### 2026-10-17 / Círculo 3 implementado (nove fatias)

**Resumo técnico**

Nove commits na `feat/product-review`: reconhecimento pela digitação, catálogo com perguntas, navegação no topo, Consultar em "/", base própria (D1), Minhas informações com ficha, barra unificada, webhook nos monitoramentos e limpeza com demonstração. 356 testes, lint, typecheck e build. Detalhes em `docs/etapa-7-escopo.md`.

### 2026-10-17 / Círculo 3B: Acervo, selos e avisos

**Resumo técnico**

Página 2 renomeada para Acervo (`/acervo`, com redirecionamento de `/informacoes`); alternância do topo só com ícones, a ativa com o nome. Selo "Agora" verde e "Depois" azul. Saíram os avisos de "base legal". A barra de pesquisa estilo Google ficou para discussão.

### 2026-10-17 / Círculo 3B: a conversa sobre a barra de pesquisa e onde o banco roda

**Resumo técnico**

Diálogo antes do código (resumo do agente). O usuário pediu uma barra "como a do Google": uma só, que procura dentro do que já foi consultado ("ERL" acha "Erllan") e oferece "Fazer nova consulta". O agente mostrou que a busca de hoje é um filtro no navegador sobre uma lista limitada (200 consultas) e comparou três jeitos de buscar no MongoDB: Atlas Search (`$search`, o melhor, mas só existe no Atlas), termos próprios com índice comum (opção B, funciona em qualquer MongoDB) e `$text` (só palavras inteiras).

A dúvida seguinte foi de base: "o app precisa de Mongo?". Ficou registrado que há três lugares onde os dados moram: memória (demonstração, sem banco), o cluster no Atlas (modo banco, o `pnpm dev` de hoje) e um MongoDB temporário que o `pnpm test` liga e apaga (o `mongod` baixado em `~/.cache/mongodb-binaries`; não há MongoDB instalado no sistema). O motor é o mesmo nos três; o Atlas só acrescenta serviços, como o Atlas Search. Conferido no código: nada usa recurso exclusivo do Atlas, e a URI aceita `mongodb://` e `mongodb+srv://`. Se o Atlas sumisse, bastaria outro MongoDB e trocar o `MONGODB_URI` (os dados se perderiam, e os monitoramentos continuariam cobrando na JUDIT).

Decisões: opção B agora, numa coleção `search_entries` (derivada, reconstruível), usada pela barra, pelo filtro do Acervo e pela página Consultar personalizada; Atlas Search como extra ligado por variável no círculo 4. A página Consultar ganha o bloco "Já capturado" abaixo das ações, porque ele serve de referência e não deve interromper o fluxo.

### 2026-10-17 / Círculo 3B implementado: busca e Consultar personalizada

**Resumo técnico**

Coleção derivada `search_entries` (termos com índice comum, opção B), barra única como a do Google, filtro do Acervo pela mesma busca e página Consultar que se recolhe para um identificador conhecido, com "Já capturado" abaixo das ações. 369 testes; conferido com digitação simulada no navegador.

**Como pensamos (resumo do agente)**

O círculo 3B seguiu o método dos círculos que o projeto adotou na etapa 7: cada volta implementa tudo o que foi decidido e a seguinte retoma os pormenores. É uma forma de desenvolvimento iterativo e incremental: o produto inteiro muda de forma a cada volta, em vez de ser decidido todo no papel antes. O usuário revisou as telas de cima para baixo, página por página, e o agente devolveu cada observação separada, com crítica, antes de codificar. Duas decisões vieram da conversa: o nome Acervo (em vez de "Dados", que confundiria com "dados cadastrais") e a opção B para a busca (portável, testável e barata), deixando o Atlas Search como extra. A posição do "Já capturado" foi escolhida pelo propósito: servir de referência sem interromper o fluxo de consultar.

### 2026-10-17 / Círculo 3B: "empresa" no texto de um CPF

**Resumo técnico**

O usuário viu "dados cadastrais da empresa" ao consultar um CPF. A chamada estava certa (a mesma `POST /entities` para os dois); o texto era um só por modalidade. Agora a explicação depende do identificador (`purposeFor`), e "Papel da empresa" virou "Papel da parte". Lição: texto genérico escrito para um caso vira erro quando o caso se amplia.

### 2026-10-17 / Círculo 3B: tipo e máscara dentro do campo

**Resumo técnico**

A pedido do usuário, o tipo reconhecido ("Pessoa física:", "Empresa:"…) aparece dentro do campo de Consultar, e os separadores de CPF, CNPJ e CNJ aparecem em tom claro. São só desenho por cima do campo (`IdentifierField`): o valor digitado não muda. Conferido no navegador com os seis tipos.

### 2026-10-17 / Círculo 3B: separadores como caracteres da caixa

**Resumo técnico**

No Firefox do usuário, a camada desenhada por cima mostrava os dois números sobrepostos (catálogo L4). Agora os pontos, a barra e o traço são caracteres da caixa, inseridos quando CPF, CNPJ ou CNJ é reconhecido. O estado guarda só os dígitos: um dígito a mais ou um apagar voltam ao número cru. Conferido no Firefox com CPF, dígito extra, apagar e CNPJ.

**Como pensamos (resumo do agente)**

O usuário descreveu o que queria: os separadores "falsos" dentro da caixa, como nos formulários de CPF, mas só depois de reconhecer o documento, porque o campo aceita qualquer tipo. O cuidado foi não gravar a máscara no estado: o reconhecimento usa a máscara digitada para decidir o tipo, e um CPF formatado seguido de mais um dígito viraria "CPF inválido" para quem digita um CNPJ. Limitação aceita: os caracteres da caixa não podem ter outra cor, e editar no meio do número leva o cursor para o fim.

---

## Perguntas e respostas

Tente responder sozinho antes de ler a resposta. As respostas foram escritas pelo agente e servem para conferir, não para substituir a sua explicação.

### Git e ambiente

**O que acontece com a tag `prototype-v0.1.0` quando novos commits entram em `main`?**

Nada. Uma tag é um nome fixo para um commit específico. A branch `main` avança a cada commit; a tag continua apontando para o commit `2af39e6`.

**Como voltar a rodar exatamente esse protótipo localmente?**

`git switch --detach prototype-v0.1.0`, depois `pnpm install` e `pnpm dev`. Para voltar ao trabalho atual: `git switch main` (ou a sua branch). Se quiser as duas versões abertas ao mesmo tempo, `git worktree add ../prototipo prototype-v0.1.0` cria outra pasta com o protótipo.

**O que aconteceria com a chave se a variável se chamasse `NEXT_PUBLIC_JUDIT_API_KEY`?**

O Next.js copia o valor de variáveis `NEXT_PUBLIC_*` para dentro do JavaScript enviado ao navegador, no momento do build. Qualquer visitante poderia ler a chave nas ferramentas de desenvolvedor e usar os seus créditos.

**A regra `deny` impede qualquer programa de ler o `.env.local`? Qual é a proteção real contra a chave ir para o GitHub?**

Não. A regra só bloqueia as ferramentas do Claude Code; outros programas (editor, terminal, scripts) leem o arquivo normalmente. A proteção contra o GitHub é o `.gitignore` (`.env*`), que impede o Git de rastrear o arquivo, somada ao hábito de conferir `git status` e `git diff` antes de cada commit.

**Por que o código não se perdeu, embora o commit tenha sido corrompido?**

O Git guarda as coisas em dois lugares independentes: os arquivos da pasta do projeto (o working tree) e cópias compactadas em `.git/objects`. O travamento aconteceu enquanto o commit era gravado. As cópias novas em `.git/objects` ficaram com 0 bytes, mas os arquivos da pasta, salvos minutos antes, já estavam no disco. Bastou criar o commit de novo a partir deles.

**Por que conferir `git hash-object` contra o índice antes de recriar o commit?**

O travamento também poderia ter danificado os arquivos da pasta. O índice ainda registrava o hash do conteúdo de cada arquivo no momento do commit. Se `git hash-object` de cada arquivo dá o mesmo hash, o conteúdo é idêntico, byte a byte, ao que ia para o commit. Assim, o commit recriado é igual ao perdido, exceto pela data.

**Por que a senha da string de conexão é a do usuário do banco, e não a da sua conta no Atlas?**

São duas identidades diferentes. A conta do Atlas é a pessoa que administra o cluster pelo site. O usuário do banco é quem a aplicação usa para ler e gravar dados, criado em "Database Access". Separá-las deixa dar à aplicação só o acesso de que ela precisa e trocar essa senha sem mexer no seu login. Se a string vazar, quem a tiver acessa os dados, mas não administra a sua conta.

**Por que um HTTP 200 não provava que o app estava lendo o MongoDB?**

O status só diz que o servidor conseguiu responder. Com `DATA_SOURCE` ausente, o app cai no modo `demo` e responde 200 com dados fictícios. Além disso, com streaming, a resposta começa antes de os dados chegarem, e um erro dentro do `Suspense` aparece depois de o 200 já ter sido enviado. A prova real é o conteúdo: o indicador "Banco de dados" no cabeçalho e os registros gravados no Atlas.

### Fase 0: client e erros

**Por que uma resposta HTTP 200 da JUDIT ainda pode representar uma falha, e em que isso difere de um HTTP 404?**

O status HTTP diz se a chamada foi aceita e processada. Com HTTP 200, o corpo ainda pode trazer `response_type: "application_error"`: a chamada estava certa, mas o resultado é uma exceção de negócio, como `LAWSUIT_NOT_FOUND`. Um 404 indica que o recurso pedido na chamada não existe, por exemplo um `request_id` inválido.

**Se um `POST /requests` der timeout, por que repetir a chamada automaticamente pode ser um problema?**

Timeout só quer dizer que paramos de esperar. A JUDIT pode ter recebido e criado a requisição mesmo assim. Repetir criaria uma segunda requisição, possivelmente cobrada de novo. A documentação não cita chave de idempotência para esse endpoint, então não há como pedir "crie só se ainda não existir".

**Por que a chave nunca aparece nas mensagens de erro?**

Os erros guardam só método, caminho, status e um trecho do corpo da resposta. Os headers da requisição nunca são anexados, e o corpo passa por `redact`, que troca a chave por `[REDACTED]` caso a JUDIT a devolva. Um teste serializa o erro inteiro e confirma que a chave não está lá.

**Por que o kill switch é verificado antes de ler a chave?**

Para que, com o kill switch desligado, nada aconteça: nem leitura da chave, nem rede. A falha é imediata e o motivo fica claro (`JuditLiveCallsDisabledError`), em vez de um erro de rede ou de autenticação.

**O que é um mock de `fetch` e por que os testes não usam a rede?**

É uma função falsa colocada no lugar do `fetch` global, que devolve a resposta que o teste escolher. Assim testamos o nosso código (headers, mapeamento de erros, validação) de forma rápida, repetível e sem gastar créditos. O `vitest.setup.ts` coloca um `fetch` que falha por padrão, para que nenhum teste chegue à rede por engano.

**Por que os schemas de resposta são "loose" e o filtro de entrada é "strict"?**

A resposta vem da JUDIT: um campo novo não deve quebrar o nosso código, então campos desconhecidos são mantidos. O filtro é montado por nós: um campo com erro de digitação deve falhar aqui, em vez de ser ignorado silenciosamente pela JUDIT.

### Fase 1: lawsuits e rotas de teste

**Por que `POST /lawsuits` usa timeout de 180s com `onDemand` e de 15s nos outros casos?**

Sem `on_demand`, a resposta vem do datalake em milissegundos. Com `on_demand`, a JUDIT pode ir ao tribunal antes de responder, e a página on-demand avisa que isso leva até 3 minutos. Com 15s, cortaríamos a conexão e pagaríamos por uma resposta que nunca leríamos.

**Por que um 404 em `GET /lawsuits/{cnj}` continua sendo erro, enquanto o 404 de `POST /lawsuits` vira lista vazia?**

Porque o significado vem da documentação de cada endpoint. Para `POST /lawsuits`, a página diz que 404 com `has_lawsuits: false` é "nenhum processo encontrado". Para `GET /lawsuits/{cnj}`, a página de erros diz que 404 é "CNJ não está no datalake", e não há corpo de resultado documentado.

**Qual a diferença entre o dado do datalake e o do tribunal, e quando o `on_demand` muda isso?**

O datalake é o cache da JUDIT com coletas anteriores: rápido e mais barato, mas pode estar atrasado. O tribunal tem o estado atual. Com `on_demand: true` em uma busca por CNJ, a JUDIT vai ao tribunal se o processo não estiver na base ou se for mais antigo que `cache_ttl_in_days`.

**Por que a rota local devolve 502 quando a JUDIT responde 401?**

A rota local funciona como um intermediário (gateway). O 401 diz que a nossa chave foi recusada pela JUDIT, não que quem chamou a rota local está sem autorização. 502 (Bad Gateway) significa "o serviço do qual eu dependo falhou"; o status original fica em `upstreamStatus`.

**Por que a allowlist não substitui autenticação nas rotas?**

A allowlist limita o que pode ser pesquisado, não quem pesquisa. Uma rota pública com allowlist ainda deixaria qualquer pessoa gastar créditos repetindo buscas permitidas. Por isso as rotas de teste só existem em desenvolvimento.

### Fase 2: requests e responses

**Depois de criar uma requisição, por que receber `status: "pending"` não significa que há algum dado pronto?**

`POST /requests` só registra o pedido: a JUDIT aceitou o trabalho e devolveu um `request_id` para acompanhá-lo. A coleta acontece depois, em segundo plano. O status passa por `pending` e `started` até `completed`; só em `completed` o conjunto de respostas é final.

**Por que podem existir duas respostas para o mesmo `request_id`, e qual delas é a mais atual?**

A JUDIT primeiro responde com o que já tem no datalake (`cached_response: true`) e, em paralelo, vai ao tribunal. Se o tribunal tiver mudanças, chega uma segunda resposta com `cached_response: false`. A de `false` é a mais atual.

**Por que o código não consulta o status automaticamente em loop?**

Cada consulta é uma requisição: conta no rate limit (180 por minuto) e a documentação não diz se é cobrada. Um loop esquecido gastaria créditos sem ninguém perceber. Por enquanto, quem decide quando consultar é você, pela rota de dev.

**Na paginação, o que significa `page_count`?**

A quantidade de itens **nesta página**, não o número de páginas. O total de páginas é `all_pages_count`, e o total de itens é `all_count`. Para percorrer tudo, aumente `page` até chegar a `all_pages_count`.

**Por que um `application_error` dentro da lista de `GET /responses` não gera erro, mas em `GET /responses/{id}` gera?**

Na lista, ele é um resultado entre outros (por exemplo, "processo não encontrado" para um item da busca), e os demais itens continuam válidos. Em `GET /responses/{id}`, a resposta inteira é o erro de aplicação, então o client o transforma em `JuditApplicationError`, como em qualquer chamada cujo resultado é uma exceção de negócio.

**Consultar o mesmo processo duas vezes no mesmo dia sai de graça, já que vem do cache?**

Não. A documentação diz que a ida ao tribunal acontece no máximo uma vez por dia por processo, mas cada requisição é cobrada normalmente, venha do cache ou do tribunal.

### Fase 3: tracking

**Qual a diferença entre monitorar um CNJ e monitorar um CNPJ?**

Com `search_type: "lawsuit_cnj"`, a JUDIT vigia **um processo que já existe** e avisa sobre novas movimentações nele. Com `cpf`, `cnpj` ou `oab`, ela vigia **o documento** e avisa quando nasce um processo novo ligado a ele, que não existia quando o monitoramento começou. A documentação diz que o monitoramento por documento roda sempre on-demand e pede para verificar o custo antes.

**Por que não há nenhum resultado logo depois de criar um monitoramento?**

Criar só agenda o trabalho. A primeira consulta ao tribunal acontece dentro de 24 horas, na janela em que a JUDIT tem melhor concorrência no tribunal; o campo `hour_range` da resposta mostra a hora prevista. Depois, ela roda a cada `recurrence` dias.

**Na dúvida, por que pausar é melhor que excluir?**

Pausar interrompe as execuções e pode ser desfeito com `resume`. Excluir é definitivo: as execuções futuras são canceladas, e o histórico só continua acessível por `GET /responses` com o `origin_id` antigo.

**Por que `recurrence` não tem valor padrão no nosso código?**

Porque é o número que define com que frequência o monitoramento roda e, portanto, quanto ele custa ao longo do tempo. Um padrão escondido (por exemplo, diário) poderia gastar créditos sem que você tivesse escolhido isso.

**Por que o PATCH não deixa trocar o processo ou documento monitorado?**

A allowlist é verificada na criação do monitoramento. Se o PATCH aceitasse um novo `search_key`, daria para trocar o alvo por um documento fora da allowlist, contornando a guarda de custo.

**Um monitoramento parado gasta créditos?**

A documentação não diz se a pausa interrompe a cobrança, só que interrompe as execuções. Como a cobrança está ligada às execuções (requisições), a hipótese razoável é que não gaste, mas isso ainda precisa ser confirmado com a JUDIT.

### Dados de teste

**Por que um processo trabalhista de uma padaria pode expor dados de uma pessoa física, mesmo que a busca seja pelo CNPJ da empresa?**

Porque o processo tem mais de uma parte. A padaria é ré, mas o autor costuma ser um ex-funcionário, com nome, às vezes CPF, salário e motivo da demissão. Buscar pelo CNPJ traz o processo inteiro, inclusive os dados dessa pessoa, que não autorizou nada. O fato de o processo ser público não torna o uso desses dados livre de regras: a LGPD continua valendo.

### Revisão do `guard.ts`

**Com `JUDIT_LIVE_CALLS=Enabled` (com "E" maiúsculo), o que acontece, e por que isso é desejável?**

As chamadas continuam bloqueadas, porque a comparação exige exatamente `"enabled"`. É desejável que um interruptor de custo falhe para o lado fechado: qualquer valor errado ou digitado com pressa mantém tudo desligado, em vez de liberar gastos por engano.

**Por que a allowlist não consegue proteger uma chamada como `getTracking(id)`?**

Porque a chamada não carrega documento nenhum, só um ID gerado pela JUDIT. O guard não tem como saber a qual documento aquele ID pertence. Para isso seria preciso registrar no banco os IDs criados pelo app (a opção C).

### Perguntas de entrevista sobre este repositório

Perguntas que um entrevistador faria usando o repositório para avaliar quem o escreveu. Tente responder em voz alta antes de ler a resposta.

**Desenhe o caminho de uma chamada, do `POST /api/dev/judit/lawsuits/count` até a JUDIT e de volta.**

A rota (`src/app/api/dev/judit/lawsuits/count/route.ts`) devolve 404 se não estiver em desenvolvimento com o kill switch ligado. Depois valida o corpo com Zod (`readInput`) e chama `countLawsuits` em `lawsuits.ts`, que passa o documento pela allowlist e chama `juditRequest`. O client verifica o kill switch, lê a chave, faz o `fetch` com timeout e valida a resposta. Qualquer erro vira JSON com status próprio em `errorResponse` (`dev-route.ts`).

**Por que existe um único `juditRequest` em vez de cada serviço chamar `fetch`?**

Para que URL base, header de autenticação, timeout, tratamento de erro e proteção da chave existam num lugar só. Corrigir um bug ali corrige todos os serviços, e os testes do client cobrem o comportamento comum uma única vez.

**Como o sistema diferencia "a JUDIT caiu" de "o processo não existe"?**

Pelos tipos de erro. Falha de rede e timeout viram `JuditNetworkError` e `JuditTimeoutError`. Status HTTP fora de 2xx vira `JuditHttpError`. Um HTTP 200 com `application_error` no corpo vira `JuditApplicationError`, com código como `LAWSUIT_NOT_FOUND`. A rota traduz isso em 502/504 (falha da JUDIT) ou 422 (a chamada funcionou, mas o resultado de negócio é um erro).

**Por que a sua rota devolve 502 quando a JUDIT devolve 401?**

O 401 é um problema entre o nosso servidor e a JUDIT (a nossa chave), não do cliente que chamou a rota. Repassar 401 faria o cliente achar que _ele_ precisa se autenticar. O 502 (Bad Gateway) diz que o serviço de trás falhou.

**Por que não há retry automático? Retry não deixaria o sistema mais robusto?**

Para leituras, deixaria. Mas `POST /requests` e `POST /tracking` criam trabalho cobrado. Se o timeout acontecer depois de a JUDIT ter recebido a chamada, repetir cria uma segunda requisição e pode cobrar duas vezes. A documentação não oferece chave de idempotência para esses endpoints. Por isso o padrão seguro é devolver o erro e deixar uma pessoa, ou uma política explícita futura, decidir.

**O que acontece se a JUDIT adicionar um campo novo na resposta amanhã? E se remover um?**

Campo novo: nada quebra, porque os schemas de resposta são tolerantes (aceitam campos extras). Campo removido: se for obrigatório no schema, a validação falha e vira `JuditUnexpectedResponseError`, com a lista dos campos problemáticos. É uma falha visível e diagnosticável, em vez de um `undefined` silencioso mais adiante.

**Como você garante que a chave da API não vaza?**

A chave está só em variável de servidor (sem `NEXT_PUBLIC_`). Os módulos usam `import "server-only"`, que quebra o build se forem importados no navegador. Erros guardam só a mensagem da causa, nunca as opções do `fetch`. O corpo de erro passa por `redact` antes de ser guardado. E o `.env*` fica fora do Git.

**A allowlist protege o quê, exatamente? E o que ela não protege?**

Protege contra buscar documentos não autorizados por este app. Não protege contra quem chama (não é autenticação), nem chamadas por ID ou listagens da conta (que não levam documento), nem uso da mesma chave fora do app. Por isso as rotas de dev só existem em desenvolvimento.

**Por que as rotas de dev devolvem 404, e não 403, quando estão desligadas?**

Um 403 confirma que a rota existe e só está bloqueada. O 404 não revela nada a quem está sondando URLs. Em produção, para quem está de fora, a rota simplesmente não existe.

**Qual a diferença entre o fluxo de `lawsuits` e o de `requests`?**

`lawsuits` é síncrono: a resposta vem no corpo da própria chamada, lida do datalake. `requests` é assíncrono: o `POST` devolve só um `request_id` com `status: "pending"`. O resultado precisa ser buscado depois em `GET /responses`, e só `completed` indica que o conjunto está final.

**Como você testou a integração sem nunca chamar a JUDIT?**

Com Vitest e `fetch` simulado: cada teste define o que o "servidor" responde (sucesso, 404, 429, 200 com `application_error`, JSON inválido, timeout) e verifica o erro ou o resultado. As fixtures foram montadas a partir dos exemplos da documentação. A limitação, assumida, é que os testes provam o comportamento do nosso código contra a _documentação_, não contra a API real. As 31 contradições do README mostram por que isso ainda precisa ser confirmado ao vivo.

_Atualização (2026-10-14):_ desde então houve chamadas reais, sempre com o documento fictício, e elas confirmaram ou corrigiram vários pontos (contradições 26, 32 a 36). Os testes de monitoramento também passaram a usar um MongoDB real e temporário: só o `fetch` continua simulado.

**Um teste encontrou um bug real. Qual foi?**

Em `POST /lawsuits`, um 404 com `has_lawsuits: false` significa "nada encontrado" e deve virar lista vazia. A primeira versão aceitava _qualquer_ 404 como lista vazia, inclusive um 404 de erro. A correção (`acceptErrorBody`) só aceita o corpo exato documentado; o resto continua sendo erro.

**Se este app fosse para produção amanhã, o que falta?**

Autenticação de usuários e autorização por dono dos dados; persistência (banco) dos IDs criados pelo app; webhook para não depender de consulta manual de status; limite de uso por usuário; monitoramento e logs sem dados sensíveis; e confirmar contra a API real as contradições documentadas.

_Atualização (2026-10-14):_ a persistência dos IDs já existe (`judit_requests` e `trackings`), e as actions só agem sobre IDs gravados pelo app. Continuam faltando autenticação, limite de uso, webhooks e uma forma de conferir envios incertos. Também falta não expor o servidor de desenvolvimento na rede (item 1 da revisão técnica no relatório).

**Este código foi escrito com ajuda de IA. Como o entrevistador sabe que você o entende?**

Não há atalho: a resposta é conseguir explicar as decisões acima, apontar onde cada uma está no código e dizer o que mudaria. Um bom sinal é saber explicar os _limites_ (o que a allowlist não cobre, por que o mock não prova a API real) e não só o que funciona.

#### Perguntas sobre as etapas 3 e 4 (2026-10-14)

**Por que o monitoramento grava uma reserva antes de chamar a JUDIT, enquanto a consulta assíncrona chama primeiro e grava depois?**

Porque o custo de um erro é diferente. Uma consulta assíncrona duplicada é cobrada uma vez. Um monitoramento duplicado é cobrado a cada recorrência, até alguém perceber. Por isso, no monitoramento, a reserva (`creation: "pending"`) passa primeiro pelo índice único do MongoDB, que recusa uma duplicata antes de qualquer chamada cobrada. Na consulta assíncrona, a escolha foi mais simples: chamar, registrar o `request_id` no log e gravar. Um bom complemento da resposta é admitir o limite: a consulta assíncrona ainda depende do botão desabilitado contra clique duplo (item 9 da revisão).

**Como você impede que dois cliques criem dois monitoramentos?**

Com duas barreiras no banco, não no código. A primeira é o índice único parcial `trackings_active_search_key_unique`: só pode existir um monitoramento ativo por identificador. A segunda vale para enviar uma reserva que já existe: `claimReservation` usa um `findOneAndUpdate` que só troca `pending` por `sending` se o documento ainda estiver `pending`. Duas requisições simultâneas não passam juntas, porque a troca é atômica. O teste "only sends a reservation once" dispara os dois cliques ao mesmo tempo e verifica uma única chamada à JUDIT.

**O que acontece se a criação do monitoramento der timeout?**

O registro fica `uncertain` e o CNPJ continua bloqueado. No timeout, a JUDIT pode ter recebido e criado o monitoramento sem a resposta voltar. Repetir arriscaria um segundo monitoramento com cobrança recorrente, e a documentação não oferece chave de idempotência. Já um HTTP 4xx significa que a JUDIT recusou, então nada foi criado e o CNPJ é liberado (`failed`). A pergunta que decide é: "a JUDIT pode ter criado?" A limitação a admitir: ainda não existe a ação "Conferir na JUDIT" para resolver um `uncertain` (item 4 da revisão).

**Por que a action de pausar consulta o MongoDB antes de chamar a JUDIT?**

Porque a allowlist só protege chamadas que levam um documento ou CNJ. Pausar, excluir e consultar recebem um ID e passariam direto: alguém poderia mexer em monitoramentos criados com a mesma chave por outro sistema. `withConfirmedTracking` exige que o ID exista no nosso banco como monitoramento confirmado, e o banco vira a barreira de autorização para o que o app criou. A consulta assíncrona faz o mesmo com `judit_requests`.

**O que é "modalidade explícita" e onde ela aparece?**

Cada consulta e cada monitoramento grava qual modalidade da JUDIT usou (`mode`: `datalake_sync`, `historical_async`, `historical_on_demand`, `tracking_document`, `tracking_lawsuit`), em vez de deixar isso implícito num parâmetro como `on_demand`. O catálogo `src/features/queries/modes.ts` descreve endpoint, fluxo, fontes, uso e custo de cada uma, e a tela usa os rótulos de lá. O identificador gravado não muda; o rótulo pode mudar. O limite a admitir: o índice de unicidade ainda não inclui `mode` (item 5 da revisão).

**Por que os processos não são gravados no seu banco?**

Porque o datalake da JUDIT já funciona como cache. O tech lead confirmou que uma consulta assíncrona concluída atualiza o datalake no mesmo fluxo da entrega. Assim, uma consulta síncrona logo depois já traz o dado novo. Copiar processos para o MongoDB criaria duas fontes de verdade, exigiria saber quando o dado envelheceu e aumentaria o volume de dado processual sensível a proteger (LGPD). Mudaria de ideia com sinais concretos: muitas consultas repetidas ao mesmo CNPJ, necessidade de funcionar com a JUDIT fora do ar ou de comparar versões antigas.

**A documentação dizia que o `PATCH /tracking` aceitava `recurrence`. Como você descobriu que não?**

A divergência já estava anotada no README como contradição 26: as páginas diziam uma coisa, o OpenAPI outra. Em vez de escolher um lado, fiz uma chamada real e controlada: `PATCH` com `{ "recurrence": 30 }` no monitoramento de teste. A JUDIT respondeu 400 com `data: ["unrecognized key: 'recurrence'"]`. O OpenAPI estava certo; troquei a função por `updateTrackingCallbackUrl`. A lição: quando prosa e especificação divergem, registre, teste com algo barato e reversível e grave a evidência.

**A JUDIT respondeu 201, mas com recorrência diferente da pedida. Como o sistema percebeu?**

Porque o código grava o que a JUDIT devolve, e não o que pedimos. Pedimos 30 dias, a resposta trouxe `recurrence: 1`, e o registro local passou a mostrar "Diária". Um `GET` logo depois confirmou o valor. Se o código gravasse o valor pedido, a tela diria "30 dias" enquanto a JUDIT rodava todo dia. A lição: 201 quer dizer "aceito", não "aceito exatamente como pedido". A melhoria pendente é avisar quando os dois valores divergirem (item 7 da revisão).

**Como você testou o fluxo de monitoramento?**

Em três camadas. Nos testes automatizados, com um MongoDB real e temporário (`mongodb-memory-server`) e o client JUDIT real, só com o `fetch` simulado. As regras importantes (índice único, troca atômica) vivem no banco, e mocks do banco não as testariam. Depois, ao vivo: as mesmas server actions que os botões chamam, disparadas por `curl` com o cabeçalho `Next-Action`, com o documento fictício. Por fim, a parte que depende do tempo da JUDIT (a primeira execução, em até 24 h) ficou para a sessão seguinte, e isso foi dito, não escondido.

**Como chamar uma server action sem a interface, e o que isso ensina sobre segurança?**

Uma server action é um `POST` para a página com o cabeçalho `Next-Action: <id>`; o ID está no manifesto gerado pelo Next. Qualquer cliente que alcance o servidor pode fazer isso, sem passar pela tela. Por isso cada action valida tudo de novo no servidor: modo, entrada, existência do registro. E por isso um servidor sem autenticação não deveria escutar na rede local com chamadas reais ligadas. O `next dev` escuta em `0.0.0.0` por padrão (item 1 da revisão).

**Desligar `JUDIT_LIVE_CALLS` interrompe a cobrança dos monitoramentos?**

Não. O kill switch só impede o nosso servidor de fazer chamadas. O monitoramento roda na JUDIT, que executa cada recorrência por conta própria. Para parar, é preciso pedir à JUDIT: pausar ou excluir.

**Por que a tela chamaria a JUDIT duas vezes em desenvolvimento?**

Porque o painel de resultados busca os dados num `useEffect`. No App Router, o Strict Mode vem ligado por padrão e, em desenvolvimento, monta cada efeito duas vezes para revelar efeitos colaterais. O `cancelled` só ignora o primeiro resultado: a chamada já saiu. Com uma API cobrada, buscar dados num efeito é um risco real. A correção é buscar no clique (item 3 da revisão).

**Se você pudesse refatorar uma coisa agora, o que seria?**

O estado duplicado dos monitoramentos. No modo `db`, a lista vive num `useReducer` iniciado uma vez com dados do servidor. O `refresh()` relê o banco, mas o reducer ignora o resultado, e por isso precisamos de `replaceTracking`. Isso desperdiça leituras e deixa a tela desatualizada quando algo muda por outro caminho, como os webhooks da etapa 5. Saber apontar o ponto fraco do próprio desenho, com consequência e correção, é exatamente o que essa pergunta quer ver.

### Fase 2a: persistência

As respostas desta seção foram escritas para a versão em PostgreSQL. A ideia de cada uma continua valendo no MongoDB; a mecânica mudou (ver "Troca para o MongoDB").

**Por que a regra "um monitoramento ativo por identificador" fica num índice do banco, e não numa consulta antes do `INSERT`?**

Porque duas requisições ao mesmo tempo podem fazer a consulta juntas, as duas veem "não existe" e as duas inserem. O índice único é verificado pelo próprio PostgreSQL no momento da inserção, então só uma passa. O teste "lets the database decide between two simultaneous requests" mostra isso; com o índice removido, as duas passaram.

**Por que o índice é "parcial" (`WHERE status IS DISTINCT FROM 'deleted'`) e não um UNIQUE simples?**

Um UNIQUE simples impediria monitorar de novo um CNPJ cujo monitoramento antigo foi excluído, ou obrigaria a apagar o histórico. O índice parcial só considera as linhas não excluídas. `IS DISTINCT FROM` é usado em vez de `<>` porque `NULL <> 'deleted'` resulta em `NULL` (nem verdadeiro nem falso), e a linha com status nulo, a que ainda não foi enviada à JUDIT, ficaria fora da regra.

**Por que `createTracking` valida a entrada de novo, se o formulário já valida?**

O formulário roda no navegador, e qualquer pessoa pode enviar uma requisição direto ao servidor sem passar por ele. A validação do formulário serve para dar retorno rápido a quem usa; a do servidor é a que protege os dados.

**Por que `ensureCompany` não fica numa transação junto com a criação do monitoramento?**

Porque não há estado inconsistente a evitar: se o monitoramento for recusado como duplicado, a empresa criada continua sendo um registro válido. Uma transação acrescentaria complexidade sem proteger nada.

### Troca para o MongoDB

**Por que o documento de monitoramento precisa de um campo `active`, se o `status` já diz se ele foi excluído?**

Porque o índice único parcial do MongoDB só aceita filtros simples (igualdade, `$exists: true`, `$gt`, `$type`...), e não "diferente de" (`$ne`). Não dá para escrever "único entre os que têm status diferente de `deleted`". O campo `active` transforma a regra numa igualdade (`active: true`). O custo é ter de manter os dois campos coerentes, papel da função `activeFor`.

**O que o PostgreSQL garantia sozinho que, no MongoDB, passou a depender do nosso código?**

Três coisas: chaves estrangeiras (um `companyId` precisava existir em `companies`), tipos e restrições das colunas (`CHECK recurrence_days > 0`, `NOT NULL`) e o esquema fixo das tabelas. No MongoDB, quem garante isso é a validação Zod no servidor e as funções de persistência. A unicidade continua sendo garantida pelo banco, via índices únicos.

**Por que usar UUID em texto como `_id`, em vez do `ObjectId` padrão do MongoDB?**

Para que o identificador seja uma string comum em toda a aplicação: nas URLs, nos tipos e nos dados de demonstração. Assim não é preciso converter `ObjectId` em cada fronteira. A desvantagem é perder a data de criação embutida no `ObjectId`, que aqui já existe em `createdAt`.

**Se o MongoDB não tem migrations, como um índice novo chega ao banco do Atlas?**

`ensureIndexes` roda na primeira conexão de cada instância do servidor, e `createIndex` não faz nada se o índice já existe igual. Um índice novo é criado na próxima vez que a aplicação subir. Mudar as opções de um índice que já existe exige removê-lo antes, e isso ainda não está automatizado.

### Fase 2b: fonte de dados

**Por que `data.ts` chama `connection()` antes de consultar o MongoDB no modo `db`?**

Com `cacheComponents`, o Next tenta pré-renderizar as páginas no build. Sem `connection()`, ele consultaria o MongoDB durante o build e congelaria o resultado na página, mostrando dados velhos para sempre. `connection()` diz "pare aqui e só continue quando houver uma requisição de verdade". O build em modo `db` foi testado com um endereço de banco inalcançável e passou, o que mostra que ele não tenta consultar o banco.

**A Server Action só é usada pelo formulário. Por que ela confere o `DATA_SOURCE` mesmo assim?**

Porque uma Server Action é, por baixo, um POST comum, e qualquer pessoa pode enviá-lo sem passar pelo formulário. Isso foi demonstrado no teste manual com `curl`. A interface esconder o botão não protege nada; quem protege é a verificação dentro da função que roda no servidor.

**Por que a página mostra um esqueleto de carregamento só no modo `db`?**

No modo `demo`, os dados ficam prontos na hora e a página inteira é gerada no build. No modo `db`, o layout espera o MongoDB responder; enquanto isso, o `<Suspense>` mostra o esqueleto. A parte estática (a "casca") é enviada antes, e os dados chegam depois na mesma resposta (streaming).

**Por que o `refresh()` é chamado depois de criar o monitoramento?**

Ao monitorar um CNPJ novo, o servidor também cria a empresa. A lista de empresas do navegador veio do servidor quando a página carregou e não sabe disso. `refresh()` pede ao navegador que busque de novo os dados do servidor, sem recarregar a página.

### Segurança do `.env`

**Por que apagar um segredo do `.env.example` num commit novo não basta, se o commit antigo já foi enviado ao GitHub?**

Porque o Git guarda o histórico inteiro. O commit antigo continua acessível pelo hash (e em clones, forks e caches feitos antes da correção). Num repositório público, o segredo deve ser considerado comprometido: a correção real é trocar a senha ou a chave no serviço de origem. Reescrever o histórico só reduz a exposição futura.

**Que diferença existe entre "o agente não deve ler o `.env.local`" e "o agente não consegue ler o `.env.local`"?**

A primeira é uma regra de conduta; a segunda é uma barreira técnica. A regra `deny` em `.claude/settings.local.json` bloqueia só a ferramenta `Read`. Pelo terminal, um comando como `node` ou `awk` ainda consegue abrir o arquivo, e foi assim que os 10 primeiros caracteres da chave vazaram na sessão anterior.

**Por que `bad auth` prova que o IP já está liberado no Atlas?**

Porque a autenticação acontece depois que a conexão chega ao servidor. Se o IP estivesse bloqueado, o driver nem alcançaria o Atlas e terminaria em `MongoServerSelectionError` (timeout) após cerca de 10 s. Receber uma resposta do servidor recusando a senha mostra que a rede funcionou e que o problema está nas credenciais.

### Teste do modo `db`

**Por que as coleções aparecem no Atlas antes de qualquer monitoramento ser gravado?**

Porque, na primeira conexão, o app chama `ensureIndexes` (`src/db/collections.ts`), e `createIndex` cria a coleção se ela ainda não existir. Basta abrir uma página que leia o banco para `companies`, `trackings`, `webhook_events` e `alerts` surgirem, vazias, mas já com os índices únicos.

### Catálogo de investigação de falhas

**Uma rota `/api/dev/judit/...` respondeu 404. Por que isso não significa que o endereço está errado, e qual o primeiro comando a rodar?**

As rotas de dev respondem 404 de propósito quando estão desligadas: fora de `NODE_ENV=development` (por exemplo, com `pnpm start`) ou sem `JUDIT_LIVE_CALLS` exatamente igual a `enabled`. É uma proteção contra custo: uma rota pública poderia gastar os créditos da chave. O primeiro comando é `pnpm env:check`, para ver o valor de `JUDIT_LIVE_CALLS`.

**Um `POST /requests` deu 504 na rota de dev. Por que não repetir a chamada imediatamente?**

O 504 só diz que nós desistimos de esperar (`JuditTimeoutError`). A JUDIT pode ter recebido e processado a requisição, e cobrado por ela. Como a documentação não menciona chave de idempotência para esse endpoint, repetir pode criar uma segunda requisição e cobrar duas vezes. Primeiro confira o histórico (`GET /requests`) e só então decida.

### Primeira chamada real

**Se a chamada respondesse `{"total": 0}`, isso provaria que a integração falhou?**

Não. HTTP 200 com um `total` numérico prova que a chave, a URL, o cabeçalho e o formato funcionaram. Zero é um resultado de negócio: o datalake não tem processos para aquele documento, ou o filtro excluiu todos. Para separar "integração quebrada" de "não há dados", olhe o status e o formato, não o valor. Com o documento fictício, a documentação promete um processo, então 0 seria uma divergência a investigar com a JUDIT, não um erro do nosso código.

**Por que o campo `limited` não quebrou a validação, e por que não o adicionamos ao schema?**

`lawsuitsCountResponseSchema` é um `z.looseObject`: exige `total` e deixa passar campos extras. Não o adicionamos porque não sabemos o que ele significa. Tipá-lo seria afirmar um contrato que a JUDIT não documentou, e nenhum código nosso precisa dele ainda.

**Por que a saída da rota de dev não prova se a JUDIT usa `lawsuits` ou `response_data`?**

Porque a rota devolve o resultado de `searchLawsuits`, e o schema faz um `transform` que pega `lawsuits ?? response_data` e sempre chama o resultado de `lawsuits`. Duas entradas diferentes produzem a mesma saída. Lição: normalizar é bom para o resto do código, mas apaga a evidência do contrato original. Para diagnosticar um contrato, observe o dado **antes** da normalização.

**O que fazer com um campo que chega como `"NÃO INFORMADO"`?**

Tratá-lo como ausência de dado, igual a `null`: não mostrar "NÃO INFORMADO" como se fosse um valor real, nem usar em filtros ou contagens. É uma convenção da JUDIT, e não um valor do tribunal.

**Qual a diferença entre um tempo limite (timeout) e um atraso (delay)?**

Um atraso faz o código **esperar** antes de agir, e toda chamada fica mais lenta. Um tempo limite é um **teto**: a chamada segue na velocidade normal e só é interrompida se passar do limite. Em `client.ts`, o `setTimeout` de 15 s dispara `controller.abort()` só quando a JUDIT demora demais; quando ela responde antes, `clearTimeout` cancela o timer e ele não tem efeito. Rate limit é uma terceira coisa: o servidor recusa (HTTP 429) quando passamos de N requisições por minuto, mas não atrasa a resposta.

**Por que medir desempenho no `next dev` engana, e onde a medida faria sentido?**

Porque o `next dev` compila cada rota sob demanda, no primeiro acesso, e não aplica as otimizações de produção: o primeiro tempo mede o compilador, não o código. A medida faz sentido com `pnpm build && pnpm start` ou, no `dev`, só a partir do segundo acesso à rota. Nas rotas `/api/dev/judit`, que respondem 404 fora do `dev`, a alternativa é olhar o `application-code` no terminal.

### Fatia 3: híbrido

**Por que guardar o `request_id` não é "replicar a JUDIT", mas guardar a lista de processos seria?**

A lista de processos é **dado** da JUDIT: copiá-la cria uma segunda fonte que envelhece e precisa ser sincronizada, além de guardar dados processuais (LGPD). O `request_id` é um **ponteiro** para um trabalho que nós mesmos pedimos: sem ele, depois de recarregar a página, não saberíamos qual request acompanhar, e o único jeito de reencontrá-lo seria listar o histórico da conta inteira (`GET /requests`). Guardamos a referência, não o conteúdo.

**A server action recusa CNPJs fora da allowlist. Por que isso não basta para publicar o app com `JUDIT_LIVE_CALLS` ligado?**

Uma server action é um `POST` que qualquer pessoa pode enviar, sem passar pelo botão. A allowlist limita **o que** é consultado, mas não **quem** consulta nem **quantas vezes**. Alguém poderia repetir a consulta do CNPJ fictício milhares de vezes, e cada uma seria cobrada. Antes de publicar, faltam autenticação e limite de taxa, ou o kill switch desligado.

**Por que o mapeamento lê `classifications` de forma defensiva em vez de tipar o campo no schema Zod?**

Porque a documentação mostra duas formas (lista de textos ou de objetos `{ code, name }`, contradição 34). Se o schema exigisse uma delas e a JUDIT mandasse a outra, a validação falharia e a consulta inteira viraria um erro (502), por causa de um campo secundário. Lendo com cuidado no mapeamento, um formato inesperado só deixa a classe em branco.

### Encerramento de 2026-10-14

**Como commitar um trabalho que ainda não terminou sem atrapalhar a `main`?**

Numa branch própria (`git switch -c feat/judit-datalake`): as mudanças não commitadas vão junto, e a `main` continua igual. O commit pode registrar uma etapa parcial, desde que os testes passem e a mensagem diga o que foi feito e o que falta. Só o merge na `main`, via PR, precisa estar "pronto". Antes de enviar ao GitHub ou abrir o PR, ainda dá para ajustar os commits.

### Editor e arquivos não salvos

**Por que o editor não atualizou a aba quando o arquivo mudou no disco?**
Porque a aba tinha alterações não salvas. Uma aba sem alterações é recarregada automaticamente. Com alterações pendentes, o editor mantém a sua versão para não perder o que você digitou. Se você salvar, o arquivo do disco é sobrescrito.

**Se a aba antiga tivesse sido salva por cima, como recuperar o diário completo?**
Com `git restore docs/diario-de-aprendizado.md`, que traz de volta a versão do último commit (`8d48c02`, 1223 linhas). Antes, rode `git diff` para ver o que vai ser descartado. O que ainda não estava commitado se perderia, porque o Git só guarda o que entrou em commit. Por isso vale commitar o diário com frequência.

### Custo do `on_demand`

**Por que gravar `onDemand` em cada request, se a JUDIT já sabe o que foi pedido?**
Para conferir a fatura e investigar falhas sem depender do painel da JUDIT. Com o campo no MongoDB, dá para contar quantas consultas caras o app disparou e comparar com o consumo cobrado. Também ajuda a explicar por que uma request demorou mais.

### Datalake e banco próprio

**Que sinal, no uso real, indicaria que chegou a hora de guardar processos no próprio banco?**
O mesmo CNPJ ou CNJ sendo consultado muitas vezes em pouco tempo, com custo ou latência pesando. Também quando a tela precisa funcionar mesmo com a JUDIT fora do ar, ou quando é preciso comparar versões antigas de um processo. Sem esses sinais, a cópia só adiciona dado sensível para proteger e manter atualizado.

### Estrutura do projeto

**Por que `searchCompanyLawsuitsAction` confere o modo, o CNPJ e a empresa, se o botão só aparece quando tudo isso já está certo?**
Porque uma server action é, por baixo, um POST que qualquer pessoa pode enviar sem usar a tela. O botão é só conveniência; a proteção real fica no servidor. Como cada chamada à JUDIT é cobrada, confiar no navegador seria abrir uma torneira de custo.

**Em qual pasta entra uma decisão como "esta consulta é `historical_on_demand`", e por que não em `src/lib/judit`?**
Em `src/features` (no catálogo de modalidades). `src/lib/judit` só sabe _como_ falar com cada endpoint, com padrões seguros. Escolher _qual_ modalidade usar e por quê é regra do produto. Separar as duas coisas deixa o client reutilizável e testável sem saber nada das telas.

### Consultas assíncronas

**Por que `checkAsyncQueryAction` procura o `request_id` no nosso banco antes de perguntar à JUDIT?**
A allowlist só protege chamadas com documento ou CNJ. Uma chamada por ID passaria direto e poderia ler consultas que outra aplicação fez com a mesma chave. Exigir que o ID exista em `judit_requests` limita a action às consultas criadas por este app.

**Por que o `request_id` é registrado no log antes de ser gravado no MongoDB?**
Quando a JUDIT responde 201, a consulta já foi aceita e cobrada. Se a gravação falhar logo depois, o ID se perderia, e com ele o resultado pago. O log guarda o ID para recuperá-lo. Ele não é segredo: sem a chave da API, não dá acesso a nada.

### Monitoramento real

**Por que desligar `JUDIT_LIVE_CALLS` não interrompe a cobrança de um monitoramento ativo?**
O kill switch só impede o nosso servidor de fazer chamadas. O monitoramento roda na JUDIT, que executa cada recorrência por conta própria, sem depender do nosso app estar ligado. A única forma de parar é pedir à JUDIT: pausar ou excluir o monitoramento.

**Por que aqui a reserva vem antes da chamada à JUDIT, se na 3b a chamada vinha antes da gravação?**
Porque o custo de um erro é diferente. Uma consulta assíncrona duplicada custa uma vez. Um monitoramento duplicado custa a cada recorrência, até alguém perceber. A reserva faz o índice único do banco recusar a duplicata antes de qualquer chamada cobrada.

**Por que um timeout mantém o CNPJ bloqueado, mas um HTTP 400 o libera?**
Com um 400, a JUDIT respondeu recusando: com certeza nada foi criado, então uma nova tentativa é segura. No timeout, a requisição pode ter chegado e sido processada sem a resposta voltar. Liberar o CNPJ permitiria criar um segundo monitoramento, possivelmente duplicado.

### Rede do servidor de dev

**Qual a diferença entre escutar em `0.0.0.0` e em `127.0.0.1`?**
O endereço define por quais interfaces de rede o servidor aceita conexões. `0.0.0.0` significa "todas": a interface local e a placa de rede, então outro aparelho no mesmo Wi-Fi alcança `192.168.15.188:3000`. `127.0.0.1` é só a interface de loopback, que existe dentro da própria máquina; uma conexão vinda de fora é recusada pelo sistema operacional antes de chegar ao Next.

**Por que um túnel para o webhook (etapa 5) continua funcionando com `-H 127.0.0.1`?**
O programa do túnel roda na mesma máquina e abre a conexão até `127.0.0.1:3000` por dentro. A JUDIT fala com o servidor público do túnel, nunca diretamente com a sua placa de rede. A rota fica exposta só pelo túnel, por isso ela vai precisar de validação própria.

### Pontas soltas da etapa 4

**Por que, se nada for encontrado, a conferência volta a reserva para pendente em vez de liberar o CNPJ?**
"Não existe na JUDIT" quer dizer que o envio nunca chegou, ou seja, a situação é a mesma de uma reserva que nunca foi enviada. Voltar para `pending` reaproveita um estado que já tem as ações certas ("Enviar à JUDIT", "Descartar reserva") e deixa a decisão de gastar com você. Liberar direto apagaria a intenção registrada; reenviar sozinho seria uma chamada cobrada sem pedido.

**Por que a conferência espera 2 minutos depois do envio?**
O nosso client desiste depois de 15 s, mas a requisição pode continuar sendo processada na JUDIT. Uma conferência logo depois poderia não achar nada, voltar a reserva para pendente e permitir um segundo envio: um monitoramento duplicado, cobrado a cada recorrência. O prazo é escolha nossa, não da documentação.

**Depois da correção do item 2, quem atualiza a linha da tabela quando você pausa um monitoramento?**
O servidor. A action grava o novo status no MongoDB e chama `refresh()`. O Next renderiza o layout de novo no servidor, que relê o banco e envia um `initialState` novo, e o provider usa essa lista diretamente. Antes, o navegador guardava uma cópia própria (`useReducer`) e precisava ser corrigido à mão com `replaceTracking`.

### Webhooks

**Por que a rota responde 503, e não 500 ou 400, quando o MongoDB está fora do ar?**
O status é uma instrução para a JUDIT. Ela só repete a entrega em 5xx ou timeout; um 4xx encerra as tentativas. Um 400 diria "o seu envio está errado" e o evento se perderia, embora o problema seja nosso e passageiro. Um 500 também faria a JUDIT repetir, mas o 503 ("serviço indisponível") descreve melhor uma falha temporária, e a rota só usa 503 para isso.

**Se o token só serve para provar a origem, por que ele precisa ser mascarado no banco?**
Porque quem lê o token consegue se passar pela JUDIT. A JUDIT devolve a `callback_url`, com o token, dentro do payload (`tags.callback_url`). Gravar o corpo como veio espalharia o segredo pelo banco, por telas de diagnóstico e por backups. Com o token em mãos, qualquer pessoa poderia mandar eventos falsos que a rota aceitaria.

**Qual a diferença entre webhook, envelope, payload e token?** _(pergunta sua, 2026-10-15)_
O webhook é o mecanismo: a JUDIT faz um `POST` para um endereço nosso quando tem novidade. Cada `POST` é uma entrega. O corpo da entrega é o envelope (`callback_id`, `reference_id`…), e dentro dele o campo `payload` traz o conteúdo em si, como o processo encontrado. O token não vem no corpo: é um segredo nosso, escrito no endereço (`?token=…`), que prova que quem chamou recebeu esse endereço da gente.

**O que é uma reentrega?** _(pergunta sua, 2026-10-15)_
É a JUDIT mandando de novo a mesma entrega, com o mesmo `callback_id`, porque não recebeu 2xx em 10 s (a rota caiu, demorou ou respondeu 5xx). Do lado de lá, a JUDIT não sabe se gravamos ou não, então repete. Do nosso lado, o índice único de `callback_id` faz a segunda cópia ser recusada, e a rota responde 200 para ela parar.

**O que são os testes automatizados, e o que eles não provam?** _(pergunta sua, 2026-10-15)_
São programas que chamam o nosso código com entradas preparadas e conferem a saída (`pnpm test` roda todos). A cada mudança, todos rodam de novo, e um comportamento antigo que quebrar aparece na hora. Eles usam substitutos: um `fetch` falso no lugar da JUDIT e um MongoDB temporário em memória. Por isso não provam o contrato real da JUDIT, só que o código faz o que nós achamos que a JUDIT espera. Isso é o papel do teste real.

**A reentrega da JUDIT é infinita?** _(pergunta sua, 2026-10-15)_
Não. A documentação diz que ela repete só em 5xx ou timeout, com intervalos crescentes, e que eventos se perdem se a URL ficar fora do ar "por muito tempo". Quantas vezes e por quanto tempo não está documentado (IK10). Um 4xx encerra na hora. Uma entrega perdida não é um dado perdido: a resposta continua disponível por `GET /responses`.

**Se a recepção funciona com o CNPJ de teste, para que usar um CNPJ real?** _(pergunta sua, 2026-10-15)_
O CNPJ de teste prova o encanamento: a JUDIT aceita a `callback_url`, entrega no formato esperado, o token e o banco funcionam. Ele não prova como o nosso código lida com dados reais: dezenas de entregas em segundos, a segunda entrega "atualizada" (`cached_response: false`), processos grandes, campos faltando e entregas de monitoramento (o de teste nunca dispara, C14). Isso não é testar a JUDIT, e sim testar as nossas suposições sobre os dados dela. Custa créditos e traz dados pessoais de terceiros, por isso a decisão fica para quando a etapa 7 precisar.

**Por que o processamento roda depois do 200, e não antes?** _(etapa 6)_
Porque receber e processar têm garantias diferentes. Para a JUDIT, o que importa é que a entrega foi guardada: depois do `insert`, nada se perde. As regras (associar, atualizar, criar alerta) consultam o banco várias vezes e podem falhar. Rodando antes do 200, uma falha viraria 5xx e a JUDIT repetiria uma entrega que já está salva, e a demora contaria contra os 10 s. Com `after()`, a falha fica registrada no próprio evento (`failed`) e se resolve com "Reprocessar".

**O mesmo processo chega duas vezes por um monitoramento por documento: o que impede dois alertas, e por que essa regra não serve para o monitoramento por CNJ?** _(etapa 6)_
O `dedupeKey` `new_lawsuit:<monitoramento>:<CNJ>`, com índice único: o segundo `insert` é recusado pelo banco, mesmo que as duas entregas sejam processadas ao mesmo tempo. No monitoramento por documento, o fato é "apareceu um processo novo", e ele acontece uma vez só. No monitoramento por CNJ, o CNJ é sempre o mesmo e o fato é "houve uma movimentação". Uma chave por CNJ avisaria só a primeira, por isso a chave é por entrega.

**A vista de suporte esconde os `request_id` de quem não deve vê-los?** _(círculo 1, 2026-10-16)_
Não. Ela só decide o que a tela desenha, e a preferência fica no navegador (`localStorage`). Os dados continuam chegando ao navegador, e qualquer pessoa pode ligar a vista ou abrir `/webhooks` direto. Esconder é interface; proteger exige login e autorização no servidor, que ficaram fora desta versão (C1-10).

**Por que a consulta de dados cadastrais é feita antes de salvar a empresa, e não depois?** _(círculo 1, 2026-10-16)_
Para que uma recusa não deixe lixo. Se a allowlist barra o CNPJ ou a JUDIT responde com erro, nada é salvo, e a pessoa escolhe "Salvar sem consultar". Se fosse salvar primeiro, uma consulta recusada deixaria uma empresa sem dados na lista. O preço: a consulta fica registrada em `sync_queries` sem `companyId`, por isso a página Consultas liga a consulta à empresa pelo CNPJ.

**Por que a base própria grava o item inteiro da JUDIT (`juditData`) além dos campos normalizados?** _(círculo 3, 2026-10-17)_
Porque "gravar tudo" e "normalizado" puxam para lados diferentes. Os campos normalizados (CNJ, tribunal, situação, datas) são o que o app usa para listar, filtrar e mostrar; eles têm o nosso formato e o nosso significado. O item inteiro garante que nada se perde: um campo que a tela ainda não usa (partes, andamentos, endereços) continua no banco, e uma tela nova pode lê-lo sem consultar e pagar de novo. O custo é mais dado pessoal guardado, por isso existe "Apagar este assunto".

**Como a regra "o mais novo substitui" impede que um dado velho passe por cima de um novo, mesmo com duas gravações ao mesmo tempo?** _(círculo 3, 2026-10-17)_
O `updateOne` com `upsert` procura o registro pela chave **e** com `fetchedAt` menor ou igual ao da gravação. Se o registro existente for mais novo, a busca não acha nada e o MongoDB tenta inserir um registro novo com a mesma chave; o índice único recusa, e o código trata essa recusa como "mantido". A decisão fica numa operação só do banco, então duas requisições simultâneas não conseguem ler, comparar e escrever em ordens trocadas.

**Por que a coleção `search_entries` é "derivada", e o que isso muda na hora de um problema?** _(círculo 3B, 2026-10-17)_
Derivada quer dizer que nada nela é fonte: tudo é calculado das outras coleções (partes, cadastros, processos, consultas, monitoramentos). Por isso a mesma função cria, atualiza e apaga uma entrada, e a coleção inteira pode ser apagada e remontada sem perda. Num problema, a pergunta muda de "o dado sumiu?" para "a cópia de busca está atrasada?": a ficha do Acervo lê as fontes, então, se ela mostra o dado e a barra não, a falha está na busca, não no dado.

**Por que `/^erl/` usa o índice e "contém erl" não?** _(círculo 3B, 2026-10-17)_
Um índice é uma lista ordenada, como um dicionário. Achar as palavras que começam com "erl" é ir até o "erl" do dicionário e ler em sequência. "Contém erl" pode estar no começo, no meio ou no fim de qualquer palavra, então não há lugar para pular: é preciso ler tudo. Por isso a busca aceita só o começo das palavras.
