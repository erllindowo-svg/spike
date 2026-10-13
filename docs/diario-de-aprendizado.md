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

### 2026-10-13 / Retomada: leitura do relatório da sessão anterior

**Resumo técnico**

Relido o relatório da sessão anterior (commit `5423aa5`, fases 0–3 do client JUDIT, 61 testes, nenhuma chamada real feita). Confirmado que a allowlist ainda só contém o CNPJ fictício e a branch não foi enviada ao remoto. Pendências manuais apresentadas para decidir o próximo passo.

**Minha explicação em palavras próprias**

> Preencha esta seção você mesmo.

### 2026-10-13 / CNJs de teste, chamada real adiada e revisão do commit

**Resumo técnico**

Não usaremos CNJs reais buscados na web: envolvem dados de terceiros e geram cobrança. A documentação oferece o CNPJ fictício `A1B2C3D4/E5F6-68` e uma chave de sandbox via comercial@judit.io. Chamada real adiada. Proposto roteiro de revisão do commit `5423aa5`.

**Minha explicação em palavras próprias**

> Preencha esta seção você mesmo.

**Perguntas de verificação** (respostas em "Perguntas e respostas")

- Por que um processo trabalhista de uma padaria pode expor dados de uma pessoa física, mesmo que a busca seja pelo CNPJ da empresa?

### 2026-10-13 / Revisão 1/6: `guard.ts`

**Resumo técnico**

Revisado `guard.ts`: kill switch em toda chamada e allowlist só com o CNPJ fictício. Achado: a allowlist não cobre chamadas por ID nem listagens da conta (`listRequests`, `listTrackings`, `deleteTracking`), que passam só pelo kill switch. O comentário do arquivo promete mais do que entrega. Decisão pendente: opções A, B ou C.

**Minha explicação em palavras próprias**

> Preencha esta seção você mesmo.

**Perguntas de verificação** (respostas em "Perguntas e respostas")

- Com `JUDIT_LIVE_CALLS=Enabled` (com "E" maiúsculo), o que acontece, e por que isso é desejável?
- Por que a allowlist não consegue proteger uma chamada como `getTracking(id)`?

### 2026-10-13 / Como acessar um commit

**Resumo técnico**

Explicado que o commit `5423aa5` é o estado atual da branch `feat/judit-client`: os arquivos já estão na pasta e podem ser abertos no editor. `git log`, `git show` e `git show <hash> -- <arquivo>` mostram o histórico e o que cada commit mudou.

**Minha explicação em palavras próprias**

> Preencha esta seção você mesmo.

### 2026-10-13 / Encerramento da revisão do commit `5423aa5`

**Resumo técnico**

Revisão encerrada pela opção A: o comentário de `guard.ts` e o README agora dizem que a allowlist não cobre chamadas por ID nem listagens da conta. A correção definitiva fica para quando houver banco. Adicionadas ao Q/A 14 perguntas de entrevista sobre o repositório, com respostas.

**Minha explicação em palavras próprias**

> Preencha esta seção você mesmo.

### 2026-10-13 / Push e pull request

**Resumo técnico**

Explicada a diferença: `git push` copia os commits da branch local para o GitHub; o pull request é um pedido, feito no GitHub, para juntar essa branch à `main`, com espaço para revisão e discussão. O push vem antes do PR. Confirmado que `JUDIT_LIVE_CALLS=` já está no `.env.example`.

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

**Um teste encontrou um bug real. Qual foi?**

Em `POST /lawsuits`, um 404 com `has_lawsuits: false` significa "nada encontrado" e deve virar lista vazia. A primeira versão aceitava _qualquer_ 404 como lista vazia, inclusive um 404 de erro. A correção (`acceptErrorBody`) só aceita o corpo exato documentado; o resto continua sendo erro.

**Se este app fosse para produção amanhã, o que falta?**

Autenticação de usuários e autorização por dono dos dados; persistência (banco) dos IDs criados pelo app; webhook para não depender de consulta manual de status; limite de uso por usuário; monitoramento e logs sem dados sensíveis; e confirmar contra a API real as contradições documentadas.

**Este código foi escrito com ajuda de IA. Como o entrevistador sabe que você o entende?**

Não há atalho: a resposta é conseguir explicar as decisões acima, apontar onde cada uma está no código e dizer o que mudaria. Um bom sinal é saber explicar os _limites_ (o que a allowlist não cobre, por que o mock não prova a API real) e não só o que funciona.
