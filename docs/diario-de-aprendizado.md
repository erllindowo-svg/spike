# Diário de aprendizagem — Raio-X Jurídico

Use este arquivo para registrar o que você aprendeu enquanto constrói o produto. Uma entrada curta e honesta vale mais que um texto extenso escrito pela IA.

## Como usar

Depois de cada fatia importante:

1. Peça ao Claude um resumo técnico objetivo do que mudou e do fluxo de dados.
2. Escreva você mesmo a seção **Minha explicação em palavras próprias** sem copiar a explicação do agente.
3. Tente responder às perguntas de verificação antes de pedir as respostas.
4. Registre qualquer dúvida que ainda não saiba resolver sem ajuda.

Não é necessário registrar alterações triviais de CSS, nomes ou formatação.

---

## Modelo de entrada

### Data / funcionalidade

**O que eu queria construir**

Descreva a finalidade da funcionalidade em uma ou duas frases.

**Resumo técnico**

O agente pode ajudar a listar os arquivos e as responsabilidades alteradas.

**Fluxo de dados**

Registre o caminho desde a ação do usuário até a resposta visível, incluindo servidor, APIs externas e banco de dados quando aplicável.

**Minha explicação em palavras próprias**

protótipo: achei de boa etiqueta de git deixar o protótipo com mock data e etc com uma tag no github nesse primeiro commit, aí o projeto vai evoluindo e perdendo funcionalidades ao tentar construí-las de fato, mas sempre tem um norte no "protótipo finalizado".
implementação da api key: tenho bastante insegurança com lidar com dados que devem ser protegidos então tomei as precauções corretas e li o que deveria ser feito/boas práticas de segurança

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

**Minha explicação em palavras próprias**

> Preencha esta seção você mesmo.

**Perguntas de verificação**

- Pergunta 1: O que acontece com a tag `prototype-v0.1.0` quando novos commits entram em `main`?
- Pergunta 2: Como você voltaria a rodar exatamente esse protótipo localmente?

### 2026-10-12 / Credencial da JUDIT no ambiente local

**Resumo técnico**

Criados `.env.local` (ignorado pelo Git, permissão `600`) e `.claude/settings.local.json`, que bloqueia a leitura de `.env*` pelo Claude Code. A chave foi colada localmente, sem passar pelo chat. Ela é lida apenas via `getServerEnv` (`src/lib/env.ts`, server-only). A checagem com `@next/env` confirmou só a presença do valor. A JUDIT não foi chamada, então a chave ainda não foi validada.

**Minha explicação em palavras próprias**

> Preencha esta seção você mesmo.

**Perguntas de verificação**

- Pergunta 1: O que aconteceria com a chave se a variável se chamasse `NEXT_PUBLIC_JUDIT_API_KEY`?
- Pergunta 2: A regra `deny` impede qualquer programa de ler o `.env.local`? Qual é a proteção real contra a chave ir para o GitHub?

### 2026-10-12 / O Claude Code precisa de `CLAUDE.md`?

**Resumo técnico**

O repositório não tinha `CLAUDE.md`, mas o `AGENTS.md` já era carregado automaticamente pelo Claude Code. `CLAUDE.md` é só o nome tradicional. O comando `/memory` mostra quais arquivos de instrução estão ativos na sessão.

**Minha explicação em palavras próprias**

> Preencha esta seção você mesmo.

### 2026-10-12 / Criação do `CLAUDE.md`

**Resumo técnico**

Criado `CLAUDE.md` com a única linha `@AGENTS.md`, que importa as instruções sem duplicá-las. Não houve commit.

**Minha explicação em palavras próprias**

> Preencha esta seção você mesmo.

### 2026-10-12 / Custo e velocidade do agente

**Resumo técnico**

Mais tokens não significa mais rapidez. `/fast` acelera a saída do mesmo modelo, com custo maior; `/model` escolhe o modelo e o esforço de raciocínio. Subagentes em paralelo foram desaconselhados porque contrariam o trabalho em incrementos pequenos e acompanháveis.

**Minha explicação em palavras próprias**

> Preencha esta seção você mesmo.

### 2026-10-13 / Fase 0: client JUDIT, erros e guarda de custo

**Resumo técnico**

Criado `juditRequest` (`src/lib/judit/client.ts`), único ponto de contato com a JUDIT: header `api-key`, timeout de 15s, erros tipados (`errors.ts`) e validação Zod tolerante. `guard.ts` bloqueia chamadas sem `JUDIT_LIVE_CALLS=enabled` e fora da allowlist. Vitest adicionado; 21 testes com `fetch` simulado, sem rede.

**Minha explicação em palavras próprias**

> Preencha esta seção você mesmo.

**Perguntas de verificação** (respostas em "Perguntas e respostas")

- Por que uma resposta HTTP 200 da JUDIT ainda pode representar uma falha, e em que isso difere de um HTTP 404?
- Se um `POST /requests` der timeout, por que repetir a chamada automaticamente pode ser um problema?

### 2026-10-13 / Fase 1: serviço lawsuits e rotas de teste manual

**Resumo técnico**

Criadas cinco funções síncronas em `src/lib/judit/lawsuits.ts` (dados cadastrais, lista, contagem, sintética e processo por CNJ), lidas do datalake da JUDIT. As rotas `src/app/api/dev/judit/...` só respondem em desenvolvimento com o kill switch ligado. Um teste revelou um bug (404 de erro aceito como lista vazia), já corrigido.

**Minha explicação em palavras próprias**

> Preencha esta seção você mesmo.

**Perguntas de verificação** (respostas em "Perguntas e respostas")

- Por que `POST /lawsuits` usa timeout de 180s com `onDemand` e de 15s nos outros casos?
- Por que um 404 em `GET /lawsuits/{cnj}` continua sendo erro, enquanto o 404 de `POST /lawsuits` vira lista vazia?
- Qual a diferença entre o dado do datalake e o do tribunal, e quando o `on_demand` muda isso?
- Por que a rota local devolve 502 quando a JUDIT responde 401?

### 2026-10-13 / Fase 2: requests e responses (fluxo assíncrono)

**Resumo técnico**

Criadas seis funções em `src/lib/judit/requests.ts` para o fluxo assíncrono: criar requisição, consultar status, listar histórico e buscar respostas (inclusive de monitoramentos). Sem polling automático. `responseCameFromCache` lê o indicador de cache em quatro lugares possíveis. Cinco rotas de dev novas, 51 testes, build ok. Diário ganhou resumos e seção Q/A.

**Minha explicação em palavras próprias**

> Preencha esta seção você mesmo.

**Perguntas de verificação** (respostas em "Perguntas e respostas")

- Depois de criar uma requisição, por que receber `status: "pending"` não significa que há algum dado pronto?
- Por que podem existir duas respostas para o mesmo `request_id`, e qual delas é a mais atual?
- Por que o código não consulta o status automaticamente em loop?

### 2026-10-13 / Fase 3: tracking (monitoramentos)

**Resumo técnico**

Criadas sete funções em `src/lib/judit/tracking.ts`: criar, listar, consultar, alterar recorrência, pausar, reativar e excluir monitoramentos. Por CNJ, vigia andamentos; por CPF/CNPJ/OAB, detecta processos novos. Primeira execução em até 24h. `recurrence` sem padrão; o DELETE de dev exige `?confirm=delete`. 61 testes, build ok.

**Minha explicação em palavras próprias**

> Preencha esta seção você mesmo.

**Perguntas de verificação** (respostas em "Perguntas e respostas")

- Qual a diferença entre monitorar um CNJ e monitorar um CNPJ?
- Por que não há nenhum resultado logo depois de criar um monitoramento?
- Na dúvida, por que pausar é melhor que excluir?

### 2026-10-13 / Encerramento do dia

**Resumo técnico**

Commit da branch `feat/judit-client` com o client JUDIT, os serviços lawsuits, requests e tracking, as rotas de dev, 61 testes e o diário. O resumo da sessão e as pendências manuais ficaram na memória local do Claude Code, para serem apresentados no início da próxima sessão.

**Minha explicação em palavras próprias**

> Preencha esta seção você mesmo.

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
