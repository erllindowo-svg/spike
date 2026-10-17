# Etapa 7: escopo do produto, em círculos

Método (definição do usuário, 2026-10-16): todas as questões de um círculo
são trabalhadas ao mesmo tempo. O círculo só termina quando todas as
pendências dele estão implementadas; aí começa o círculo seguinte, que
retoma cada implementação para tratar os pormenores dela. Cada volta detalha
a anterior, num ciclo de detalhamento. Uma escolha de um círculo externo só
é revista num círculo interno se aparecer um fato novo, e o motivo fica
registrado aqui.

(A primeira versão deste parágrafo, de 2026-10-15, descrevia os círculos
como etapas de decisão, sem implementação entre elas. Foi corrigida pelo
usuário.)

Fontes: anotações de `docs/etapa-7-uso-guiado.md`, candidatos de
`docs/plano-etapas-6-7.md` ("Etapa 7 redefinida") e pendências de
`docs/relatorio-de-progresso.md`.

## Círculo 1: forma geral (2026-10-15)

### Pontos levantados

[U] = ditado no uso guiado; [P] = candidato anterior do plano ou do relatório.

**Verdade da tela**

1. [U] Configurações diz "Não configurado" para tudo, e o app parecia estar
   na demonstração. Causa: textos fixos do protótipo da etapa 1 (inventário
   no guia do uso guiado).
2. [U] Entre esses textos, "Exemplos fictícios" aparece na seção de
   movimentações de um processo vindo da JUDIT (`lawsuit-details.tsx:124`).
   No modo `db` essa seção fica sempre vazia: as movimentações (`steps`)
   não são convertidas (`processes/judit.ts:37-38`).

**Navegação**

3. [U] "Visão geral" deve se chamar "Dashboard".
4. [U] Menu recolhível, só com ícones. Fato: já existe
   (`app-sidebar.tsx:95`, `collapsible="icon"`). O botão é o primeiro do
   cabeçalho, à esquerda, e Ctrl+B alterna (`sidebar.tsx:33`). O atrito é
   descobrir que ele existe.
5. [U] Itens secundários pequenos, embaixo, perto de Configurações.
6. [U] Um ícone "i" que explique, bem resumido, cada possibilidade do app.
7. [U] Poucas opções no menu, perto do que a JUDIT oferece.

**Organização do domínio**

8. [U] Alertas dentro de Monitoramentos, porque são filhos dos eventos deles.
   O código confirma: só evento de monitoramento gera alerta
   (`process.ts:41-51`).
9. [U] Diagnóstico de webhooks: onde ficam as consultas que chegam por
   webhook e as normais.
10. [U] Um dashboard geral com empresas e pessoas físicas, e um monitoramento
    que unifique as duas. Pergunta: existe monitoramento de pessoa física?
    (Resposta na consideração 5.)
11. [U] Digitar um CNPJ e o app encontrar; buscar pelo nome da empresa.
12. [P] Como o resultado de uma consulta com webhook aparece na tela.
13. [P] `/processos/[cnj]` dá 404 no modo `db`; razão social vazia (viria de
    `POST /entities`).

**Público e acesso**

14. [U] "Modo desenvolvedor" em Configurações: o advogado não precisa ver
    callback ID, event type e reference ID.
15. [U] Vários perfis num escritório: login ou, no mínimo, personalização no
    lugar de "Usuário de demonstração".

**Back-end**

16. [U] Um evento de saída, sem uso, para ilustrar o envio de uma notificação
    para fora (o "macho da tomada", sem fêmea).

**Pequenos, para círculos internos** [P]: aviso de `<Suspense>` em
`/empresas` (catálogo D5); horário UTC mostrado como local (item 14, IK5);
card da consulta assíncrona sem `try/catch` e sem resumo guardado (itens 6 e
8); componentes grandes e rótulos com `toLowerCase` (itens 15 e 16);
conferência de entregas perdidas (IK10).

### Considerações do agente

1. **O menu segue a ordem em que o app foi construído, não as tarefas do
   cliente.** Empresas veio da etapa 2, Monitoramentos da 4, Alertas e
   Webhooks da 6: cada etapa ganhou uma página. Os pontos 3, 5, 8, 9, 10 e 14
   pedem a mesma coisa: organizar pelo que o cliente quer saber. É um efeito
   comum de construir em fatias (a interface espelha o back-end), e a etapa
   7 existe para corrigi-lo.

2. **Há dois públicos, e o segundo é o objetivo do projeto.** O advogado
   quer saber "tem risco?" e "o que mudou?". A pessoa de suporte quer IDs,
   status de processamento e entregas repetidas, e o catálogo de falhas é o
   objetivo central deste projeto. O "modo desenvolvedor" é, portanto, a
   decisão de ter duas vistas do mesmo dado. Um interruptor esconde, mas não
   protege: serve para a interface, não para a segurança.

3. **O alerta tem dono, mas também é uma caixa de entrada.** Pelo dado, ele
   pertence ao monitoramento. Pela tarefa "Bom dia" (tarefa 4 do roteiro), a
   pessoa quer ver o que chegou em todas as empresas de uma vez. Se o alerta
   só existir dentro de cada monitoramento, essa tarefa vira abrir um por um.
   A forma usual é as duas coisas: o alerta mora no monitoramento e aparece
   também num resumo cruzado (sino no cabeçalho ou bloco no Dashboard). Hoje
   não existe página de um monitoramento só; a tabela é a única vista.

4. **Webhook é o canal, não a coisa.** Para o cliente, existem a consulta
   (síncrona ou assíncrona) e o monitoramento. Se o resultado chegou por
   webhook ou por polling é transporte: importa para o suporte, não para o
   advogado. Daí a resposta ao ponto 9: as consultas, de qualquer canal,
   ficam juntas numa vista de consultas, e o Diagnóstico de webhooks continua
   como o registro técnico das entregas recebidas, na vista de suporte.
   Restrição: consultas síncronas não são gravadas (desenho híbrido da etapa
   3); só as assíncronas têm registro em `judit_requests`. Um histórico
   completo exige gravar os metadados das síncronas, que é uma decisão de
   banco para um círculo interno. A JUDIT tem um relatório de consumo com
   `origin: api | tracking`
   ([consumption/history](https://docs.judit.io/resource/consumption/history));
   não verifiquei se consultá-lo é cobrado.

5. **Pessoa física: a JUDIT aceita; o projeto não consegue testar.** O
   monitoramento por documento aceita `cpf`, `cnpj` ou `oab`
   ([tracking-document](https://docs.judit.io/tracking/tracking-document)), e
   as consultas e os dados cadastrais também aceitam CPF. O client já tipa
   `cpf` (`tracking.ts:32`). Mas o único documento de teste citado na
   documentação é o CNPJ `A1B2C3D4/E5F6-68` (IK13); CPF é dado pessoal de
   pessoa natural; e o app inteiro está construído sobre "empresa" (coleção
   `companies`, rota `/empresas/[cnpj]`). Pessoa física muda o modelo de
   dados e ficaria sem teste ao vivo.

6. **Cada capacidade nova da JUDIT é uma fatia vertical inteira:** chamada
   cobrada, allowlist, schema, tela e teste real, num produto que termina na
   etapa 7. Dados cadastrais (`POST /entities`) é a exceção barata: o client
   já tem `getEntity`, e ela resolve duas pendências (razão social vazia e a
   tarefa "Empresa nova"). Mandados e execução penal são, na prática, de
   pessoa física (dependem da consideração 5). O DJEN é outro produto
   (publicações, não processos).

7. **Buscar na JUDIT pela caixa de busca custaria dinheiro a cada Enter.**
   Pela sua decisão da etapa 3, toda consulta declara a modalidade. "Digitar
   CNPJ e achar" vira: busca no banco → não achou → botão explícito
   "Consultar na JUDIT" → resultado → "Salvar empresa" ou "Monitorar". Hoje
   uma empresa só entra no banco ao criar um monitoramento
   (`trackings/db.ts:112`); salvar sem monitorar muda essa regra. Busca por
   nome: a JUDIT aceita, com aviso de homônimos, mas não há nome de teste
   (`guard.ts:41`, `name: []`). É o mesmo problema da pessoa física.

8. **Login é a maior decisão da lista e a mais fácil de subestimar.** Vários
   perfis exigem autenticação (dependência nova), autorização (quem vê o
   quê) e separação dos dados por escritório ou pessoa; o `AGENTS.md` pede
   conversa antes (seções 2 e 8). Em sentido contrário, publicar o app com
   chamadas reais já exige autenticação e limite de taxa (pendência do
   relatório). Um "perfil local" no navegador personaliza sem proteger e
   arrisca parecer seguro.

9. **O "macho da tomada" é um padrão conhecido.** Publicar um evento sem
   saber quem consome é um evento de domínio; gravá-lo numa tabela antes de
   enviar é o padrão outbox; enviá-lo para uma URL do cliente é um webhook de
   saída (o que a JUDIT faz conosco). A regra do `AGENTS.md` contra
   abstração sem necessidade não barra este caso: a necessidade é didática e
   explícita. Cuidado para o futuro: se a tomada ganhar uma fêmea, dados de
   processo saem do app; o evento deve levar o mínimo (tipo e IDs), não o
   processo. A JUDIT tem `notification_emails` no monitoramento
   ([glossário](https://docs.judit.io/resource/glossary)), mas essa
   notificação é dela, não nossa.

10. **Os dois produtos do fim da etapa 7 pesam em cada escolha.** O
    protótipo é gerado a partir do app revisado. Se ele mostrar o que o app
    real não faz (pessoa física, busca por nome), vende um produto que não
    existe.

11. **Os textos falsos podem ser corrigidos já.** O motivo para esperar
    (não mexer duas vezes nos mesmos arquivos) vale para os textos de
    "demonstração", que somem na separação dos produtos. Não vale para os
    textos falsos no modo `db`, que enganam quem usa o app real agora.

### Escolhas do círculo 1

Opções e a recomendação do agente (rec.). ⚠ = afeta banco, segurança ou a
estrutura central; pede conversa antes do código (`AGENTS.md`, seção 2).

| #     | Escolha                    | Opções                                                                                                                                                                                                                                           | Rec. |
| ----- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---- |
| C1-1  | Público da interface       | (a) só o cliente, nada técnico; (b) cliente e uma vista de suporte, ligada em Configurações; (c) técnica, como hoje                                                                                                                              | b    |
| C1-2  | Forma do menu              | (a) o atual com ajustes (Dashboard, Diagnóstico embaixo); (b) por tarefa: Dashboard, Empresas, Monitoramentos (com alertas), Consultas; embaixo, pequenos, Diagnóstico (só na vista de suporte) e Configurações                                  | b    |
| C1-3  | Lugar dos alertas          | (a) só dentro de cada monitoramento; (b) dentro do monitoramento e num resumo cruzado (sino ou Dashboard); (c) página própria, como hoje                                                                                                         | b    |
| C1-4  | Consultas e canais ⚠       | (a) página "Consultas" com todas, o canal (webhook ou polling) como detalhe; Diagnóstico como registro técnico; (b) consultas só na página da empresa, como hoje; (c) consultas e Diagnóstico numa página só                                     | a    |
| C1-5  | Pessoa física ⚠            | (a) fora deste produto, registrada para a próxima versão; (b) modelo "parte" (CPF ou CNPJ) no app real, sem teste ao vivo até haver CPF de teste; (c) só no protótipo                                                                            | a    |
| C1-6  | Busca ⚠                    | (a) banco e, para CNPJ desconhecido, botão explícito "Consultar na JUDIT" que permite salvar a empresa sem monitorar; (b) só banco, com o texto corrigido; (c) a, mais busca por nome na JUDIT                                                   | a    |
| C1-7  | Capacidades novas da JUDIT | (a) só dados cadastrais; (b) a, mais mandados e execução penal (dependem de C1-5); (c) a, mais DJEN; (d) nenhuma                                                                                                                                 | a    |
| C1-8  | Conteúdo do Dashboard      | (a) caixa de entrada primeiro (alertas novos, consultas concluídas, monitoramentos com problema) e poucos números; (b) números e gráficos, como hoje; (c) igual a hoje, só com o nome novo                                                       | a    |
| C1-9  | Ajuda ("i")                | (a) um "i" no título de cada página, com duas ou três frases; (b) um "i" só no Dashboard, explicando tudo; (c) uma página "Como funciona"                                                                                                        | a    |
| C1-10 | Usuários ⚠                 | (a) fora do produto, trocando "Usuário de demonstração" por um texto honesto; (b) perfil local no navegador, sem segurança; (c) login real                                                                                                       | a    |
| C1-11 | Notificação de saída       | (a) função chamada ao criar alerta, que monta o evento mínimo e só registra "sem destino"; (b) fila de saída gravada no banco (outbox), nunca consumida, visível no Diagnóstico ⚠; (c) envio real para uma URL configurável, vazia = desligado ⚠ | a    |
| C1-12 | Protótipo e app real       | (a) o protótipo mostra só o que o app real faz; (b) o protótipo pode mostrar funções futuras, marcadas como tal                                                                                                                                  | a    |
| C1-13 | Textos falsos              | (a) primeira fatia da etapa 7, já; (b) só na separação dos produtos                                                                                                                                                                              | a    |

### Decisões

**2026-10-15.** O usuário escolheu "o recomendado, mas crie o dashboard":

- C1-1 a C1-7 e C1-9 a C1-13: como recomendado (opção a de cada uma; em
  C1-1 a C1-3, opção b).
- **C1-8: um dashboard geral de verdade**, que mostra todas as áreas
  (empresas, monitoramentos, alertas, consultas) com números e gráficos, e
  não só uma caixa de entrada. Leitura do agente: a caixa de entrada
  ("o que chegou") vira um dos blocos do dashboard, não o seu centro. Como
  C1-5 deixou a pessoa física de fora, "empresas e pessoas físicas" do ponto
  10 fica só "empresas" nesta versão. O desenho dos blocos é do círculo 2.
- C1-13 começa já: corrigir os textos falsos no modo `db`. O menu, o
  Dashboard e a busca são redesenhados nos círculos seguintes; os textos
  deles só são corrigidos agora quando afirmam algo falso.

**2026-10-16.** O usuário pediu a implementação, sem interrupção, de todas
as escolhas do círculo 1. O plano e o estado de cada item ficam em
"Implementação do círculo 1", abaixo.

### Implementação do círculo 1

Decisões tomadas pelo agente durante a implementação, para o usuário revisar
(nenhuma é difícil de desfazer):

- **C1-1, vista de suporte:** preferência guardada no navegador
  (`localStorage`), não no servidor. É um filtro de interface, não uma
  proteção: quem tem o endereço abre qualquer página.
- **C1-3, alertas:** saem do menu e viram uma aba de Monitoramentos
  (`/monitoramentos/alertas`; o endereço antigo `/alertas` redireciona). Cada
  monitoramento mostra quantos alertas não lidos tem e leva aos alertas
  dele. O resumo cruzado é o sino no cabeçalho e o bloco "O que chegou" do
  Dashboard.
- **C1-4, consultas:** a página lista as assíncronas (`judit_requests`) e
  as síncronas. Para listar as síncronas, uma coleção nova, `sync_queries`,
  guarda só metadados de cada chamada que chegou à JUDIT (modalidade,
  empresa, `request_id`, quantidade de itens, resultado), nunca os dados
  devolvidos. Chamadas barradas antes de sair do servidor (kill switch,
  allowlist) não são registradas: não chegaram à JUDIT nem foram cobradas.
- **C1-6 e C1-7, busca e dados cadastrais:** CNPJ desconhecido leva à lista
  de Empresas, que oferece "Adicionar empresa". O diálogo tem dois caminhos:
  salvar sem consultar (grátis) ou consultar os dados cadastrais na JUDIT e
  salvar (cobrado, preenche razão social e situação). A empresa salva
  também ganha "Atualizar dados cadastrais".
- **C1-11, evento de saída:** cada alerta criado gera um evento
  `alert.created` com tipo e IDs, sem dados do processo. Sem destino
  configurado, ele só é registrado no log.
- **C1-5 e C1-12:** não geram código. A pessoa física fica para a próxima
  versão; o protótipo, quando for separado, só mostra o que o app real faz.

#### Estado de cada item (2026-10-16)

Todos os itens do círculo 1 estão implementados, sem commit. Verificado:
`pnpm test` (252 testes), `pnpm lint`, `pnpm typecheck`, `pnpm format:check`
e `pnpm build`; todas as páginas abertas no modo `db` (o `pnpm dev` do
usuário) e num build separado no modo `demo`, com capturas de tela do
Dashboard, de Consultas, de Monitoramentos e da página da empresa.

| Item                  | Onde está                                                                                                                         |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| C1-1 vista de suporte | `src/features/settings/support-view.tsx`; botão em Configurações                                                                  |
| C1-2 menu             | `src/components/layout/navigation.ts`, `app-sidebar.tsx`                                                                          |
| C1-3 alertas          | `app/(app)/monitoramentos/layout.tsx` e `alertas/page.tsx`; coluna "Alertas" em `trackings-table.tsx`; sino em `app-header.tsx`   |
| C1-4 consultas        | `app/(app)/consultas/page.tsx`, `features/queries/components/queries-page.tsx`, `types.ts`, `sync-log.ts`; coleção `sync_queries` |
| C1-5 pessoa física    | fora desta versão (IK13: falta um CPF de teste)                                                                                   |
| C1-6 busca            | `global-search.tsx` leva o CNPJ desconhecido a Empresas; `add-company-dialog.tsx`                                                 |
| C1-7 dados cadastrais | `features/companies/actions.ts`, `registration.ts`; botão na página da empresa                                                    |
| C1-8 Dashboard        | `features/overview/components/overview-dashboard.tsx`, `stats.ts`, `components/shared/column-chart.tsx`                           |
| C1-9 ajuda "i"        | textos em `navigation.ts` (`getPageInfo`); `components/ui/popover.tsx`                                                            |
| C1-10 usuários        | "Sem login" no menu do perfil (feito na fatia C1-13)                                                                              |
| C1-11 evento de saída | `features/notifications/outbound.ts`, chamado em `features/webhooks/process.ts`                                                   |
| C1-12 protótipo       | princípio para a separação dos produtos; sem código                                                                               |
| C1-13 textos falsos   | `features/settings/status.ts` e os textos corrigidos                                                                              |

Não verificado ao vivo: a consulta de dados cadastrais (`POST /entities`)
nunca foi feita de verdade. Duas hipóteses dependem dela: que a JUDIT aceite
o CNPJ sem máscara nesse endpoint (aceita em `/lawsuits` e `/requests`) e o
que ela devolve para o CNPJ de teste. Os índices novos
(`sync_queries_created_at`, `judit_requests_created_at`) só são criados
quando o `pnpm dev` reinicia (catálogo, G4); sem eles, tudo funciona.

## Círculo 2: pormenores (a abrir)

Pendências observadas ao implementar o círculo 1, mais as que já estavam
listadas. Nada aqui foi decidido.

**Do círculo 1**

- Consultas: "Verificar status" na própria página (hoje leva à empresa); na
  demonstração, esse link cai numa página sem o card das consultas
  assíncronas; filtro por status; paginação.
- Alertas: "Marcar estes como lidos" (filtro por monitoramento) envia uma
  chamada por alerta; uma página por monitoramento, com os alertas dele; o
  sino só mostra o número, sem a lista.
- Vista de suporte: ao carregar, a página nasce com ela desligada e liga um
  instante depois (o servidor não conhece a preferência do navegador).
- Empresa: "Atividade recente" fica sempre vazia no modo `db` (a atividade
  não é gravada); o nome fantasia (`social_name`) não é guardado; a consulta
  de dados cadastrais on-demand (Receita em tempo real) não é oferecida; o
  card das consultas assíncronas ainda fala em `request_id` e
  `cache_ttl_in_days` para quem não é do suporte.
- Adicionar empresa: não existe na demonstração (a lista de empresas
  fictícias é fixa), o que importa para o protótipo (C1-12).
- Dashboard: os números poderiam levar às listas filtradas; o período dos
  gráficos é fixo (14 dias).
- Ajuda "i": revisar os textos com o usuário.
- Evento de saída: escolher, se um dia houver, o destino e o formato.

**De antes**

- `/processos/[cnj]` dá 404 no modo `db`.
- Aviso de `<Suspense>` em `/empresas` (catálogo D5).
- Horário em UTC mostrado como local (item 14, IK5).
- Card da consulta assíncrona sem `try/catch` (item 6).
- Componentes grandes e rótulos com `toLowerCase` (itens 15 e 16).
- Conferência de entregas perdidas (IK10).

## Revisão do círculo 1: todos os identificadores (2026-10-16)

### Ditado do usuário

> Acho que tem que ter uma aba de pessoas físicas, e o produto tem que ser
> personalizado para usar todo tipo de identificador aceito pelos endpoints
> da JUDIT: CNPJ, CPF, CNJ, por exemplo. Em monitoramento, não faz sentido
> falar de empresa. Talvez criar uma área mais expressa (pessoa física,
> empresa) onde dá para fazer as consultas únicas, em que você só pega a
> informação, sem necessariamente colocar em monitoramento. E a barra de
> pesquisa lá em cima: você pesquisa, por exemplo, "Padariazinha de Jesus",
> ela aparece, você clica e vai para a página do monitoramento que colocou
> nela. Mas também daria para pesquisar um documento ali, e a barra lê e faz
> um POST. Acho que o front tem que pensar em todas as alternativas
> documentais.

Isto reabre a C1-5 (pessoa física fora desta versão) e mexe na C1-2 (menu)
e na C1-6 (busca). Motivo registrado: decisão nova do usuário.

### O que a JUDIT aceita, por identificador

Fontes: [hotstorage](https://docs.judit.io/cache-judit/hotstorage),
[request-document](https://docs.judit.io/requests/request-document),
[registration-data](https://docs.judit.io/registration-data/registration-data),
[tracking-document](https://docs.judit.io/tracking/tracking-document),
[tracking-communication](https://docs.judit.io/tracking/tracking-communication).

| Identificador | Consulta síncrona | Consulta assíncrona | Dados cadastrais | Monitoramento                 |
| ------------- | ----------------- | ------------------- | ---------------- | ----------------------------- |
| CNPJ          | sim               | sim                 | sim              | sim (por documento)           |
| CPF           | sim               | sim                 | sim              | sim (por documento)           |
| OAB           | sim               | sim                 | não              | sim (por documento)           |
| Nome          | sim               | sim                 | sim              | só o do Diário Oficial (DJEN) |
| CNJ           | sim               | sim                 | não              | sim (processual)              |

Fora do produto hoje: mandados de prisão (CPF, nome, RJI) e execução penal
(CPF, CNPJ, nome, CNJ).

### Escolhas da revisão (pendentes)

| #   | Escolha              | Opções                                                                                                                                                                                | Rec. |
| --- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| R1  | Identificadores      | (a) CNPJ, CPF e CNJ agora; OAB e nome depois; (b) todos já; (c) manter CNPJ e CNJ                                                                                                     | a    |
| R2  | Banco ⚠              | (a) uma coleção de partes com o tipo do documento (migra `companies`); (b) coleção `people` separada; (c) campo novo em `companies`                                                   | a    |
| R3  | Telas                | (a) "Empresas" e "Pessoas físicas" como abas de uma seção, mais uma página "Consultar" para consultas avulsas; (b) duas entradas no menu; (c) uma lista só, com filtro por tipo       | a    |
| R4  | Barra de pesquisa    | (a) reconhece o tipo pelo formato, mostra o que já está no app e oferece "Consultar na JUDIT" como item explícito (cobrado); (b) consulta a JUDIT ao apertar Enter quando é documento | a    |
| R5  | Teste com CPF ⚠      | (a) construir já e testar com dados simulados até o IK13 ter resposta; (b) liberar o CPF do próprio usuário na allowlist, com o consentimento dele; (c) esperar uma chave de sandbox  | a    |
| R6  | Privacidade do CPF ⚠ | (a) mascarado nas listas, completo só na página da pessoa; guardar só nome e CPF; (b) completo em todo lugar                                                                          | a    |

Em monitoramento, a coluna "Empresa" vira "Alvo" (o identificador com o
tipo), independente das escolhas acima.

## Para os círculos 3 ou 4: o app como base para clientes (2026-10-16)

### Ditado do usuário

> É importante que o programa tenha no back-end várias dessas tomadas macho,
> para realmente ser um grande aplicativo base para um cliente: como se você
> pudesse enviar este repositório para um cliente e ele já tivesse um
> aplicativo com vários casos de uso impressos nele. Tem que ter a tomada
> macho do login: um menuzinho em que você pode colocar um nome genérico, e
> o próprio menu diz que essa informação de login não leva a nada. Tem que
> ter no banco de dados uma seção para isso e, no back-end, uma autenticação
> programada, mesmo que a gente não use. Não precisa ser agora: fica para o
> terceiro ou quarto círculo.

### Notas do agente (sem decisão)

- É a mesma ideia do evento `alert.created` (C1-11), generalizada: pontos de
  extensão prontos, sem destino ligado.
- O login "tomada" precisa deixar claro, na tela e no código, que não
  protege nada. O mesmo cuidado da vista de suporte e do aviso "Sem login":
  um login que parece real e não protege é pior do que nenhum.
- Candidatos a outras tomadas, para discutir no círculo certo: notificação
  por e-mail ou Slack, exportação de relatórios, autorização por perfil e
  limite de consultas por usuário (este, uma pendência antiga para publicar
  o app).

## Proteção de custo além da allowlist (2026-10-16)

### Ditado do usuário

> A allowlist é muito limitante. Tem que ter algo menos restritivo nesse
> processo de limitação e de segurança, para não gastar muito da API: um
> safeguard no back-end que não deixe sair muita requisição ao mesmo tempo,
> e que entenda o que é um fluxo de dados normal. Por exemplo: eu consegui
> puxar os processos do Banco Itaú e não vi o banco de dados inteiro de uma
> vez, quebrando minhas pernas. Se tivesse alguma discriminação assim...
> porque só limitar não é um jogo muito bom.

### Fatos da documentação (lidos em 2026-10-16)

- Limite da JUDIT: 180 requisições por minuto por chave, em janela
  deslizante ([rate-limits](https://docs.judit.io/essentialConcepts/rate-limits));
  a página da consulta síncrona fala em 500 por minuto (README da
  integração, item 43).
- Cobrança por requisição; não está dito se o volume devolvido muda o preço
  (IK14).
- A consulta síncrona (`POST /lawsuits`) não tem paginação: devolve tudo de
  uma vez. As listas assíncronas (`GET /responses`) são paginadas, até 1.000
  por página ([pagination](https://docs.judit.io/essentialConcepts/pagination)).

### Escolhas

| #   | Escolha          | Opções                                                                                                                                                        | Rec. |
| --- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| S1  | Allowlist        | (a) vira um modo restrito, ligado por padrão até o usuário desligar; (b) removida; (c) continua a única barreira                                              | a    |
| S2  | Ritmo            | (a) limite no servidor, abaixo dos 180/min da JUDIT, e uma chamada por vez para a mesma busca; (b) só tratar o 429 da JUDIT                                   | a    |
| S3  | Teto de gasto    | (a) teto diário de chamadas cobradas, contado no nosso histórico; (b) ler o consumo da JUDIT antes de cada chamada; (c) as duas                               | a    |
| S4  | Volume           | (a) "raio-x rápido" (contagem e resumo agrupado) antes da lista; lista grande pede confirmação e a tela mostra no máximo algumas centenas de linhas; (b) nada | a    |
| S5  | Documentos reais | (a) só depois de S1 a S4 implementados e testados com o CNPJ de teste; (b) já                                                                                 | a    |

## Círculo 2: plano (2026-10-16)

O usuário pediu (2026-10-16) o commit do círculo 1, a montagem do círculo 2
com tudo o que foi coletado e a implementação sem interrupção. As escolhas
R1 a R6 e S1 a S5 não foram respondidas uma a uma; o agente segue as
recomendações de cada tabela e registra aqui o que decidir no caminho. O
login e as "tomadas" do back-end ficam para os círculos 3 ou 4, como o
usuário pediu.

Fatias, nesta ordem (cada uma com testes e commit próprio):

1. **Proteção de custo (S1 a S4).** Vem antes de abrir CPF e documentos
   reais: ritmo por minuto, uma chamada por vez para a mesma busca, teto
   diário contado no histórico, allowlist como modo restrito (ligado).
2. **Partes (R1, R2, R6).** Coleção única de partes (CNPJ e CPF), com
   migração das empresas e das referências; CPF mascarado nas listas.
3. **Telas de partes (R3).** Empresas e Pessoas físicas como abas;
   página da pessoa; adicionar pessoa.
4. **Consultar (consultas avulsas).** Uma página guiada pelo catálogo de
   features (`docs/mapa-funcionalidades-judit.md`): contagem, resumo
   agrupado, lista, histórico assíncrono, dados cadastrais, processo por
   CNJ, mandados, execução penal.
5. **Busca (R4).** A barra reconhece o tipo do identificador, mostra o que
   já está no app e oferece "Consultar na JUDIT" como item explícito.
6. **Monitoramentos.** Coluna "Alvo"; monitoramento por CPF; filtro de
   termos nas movimentações (F21).
7. **Conta.** Saldo e consumo da JUDIT (F27, F28) em Configurações e no
   Dashboard.
8. **Processo por CNJ no modo `db`.** A página do processo deixa de dar 404.
9. **Pormenores do círculo 1** (lista "Círculo 2: pormenores", acima).

### Estado do círculo 2

- **Fatia 1, proteção de custo: feita.** Allowlist como modo restrito
  (`JUDIT_ALLOWLIST`, ligado salvo "disabled"); limite por minuto
  (`JUDIT_MAX_CALLS_PER_MINUTE`, padrão 30) e chamada única para a mesma
  busca, no client (`src/lib/judit/rate-limit.ts`); teto diário
  (`JUDIT_DAILY_CALL_LIMIT`, padrão 50) contado em `sync_queries`,
  `judit_requests` e monitoramentos confirmados
  (`src/features/queries/budget.ts`), aplicado em todas as ações cobradas;
  a consulta síncrona entrega no máximo 500 processos à tela, com o total;
  linha "Proteção de custo" em Configurações, com o uso de hoje. Casos H1 a
  H3 no catálogo do diário. A allowlist continua ligada: liberar documentos
  reais é decisão do usuário (S5).
- **Fatias 2 e 3, partes e telas de pessoas: feitas.** Coleção `parties`
  (CNPJ e CPF) com migração automática das empresas e de `companyId` para
  `partyId` (`src/db/migrations.ts`, testada num MongoDB temporário com dados
  no formato antigo: a coleção antiga fica como `companies_migrated`);
  módulo de documentos (`src/features/parties/documents.ts`: validação,
  máscara, rota de cada tipo); CPF mascarado nas listas, nos alertas e nos
  textos gravados; abas Empresas e Pessoas físicas (`/empresas`,
  `/pessoas`); página da pessoa (sem nome nem CPF no título da aba);
  adicionar pessoa; consultas síncrona, assíncrona e de dados cadastrais e
  monitoramento por CPF. Na demonstração, duas pessoas fictícias (CPF
  começando com zeros). OAB e nome continuam fora (R1). **Reiniciar o
  `pnpm dev`** para a migração rodar no Atlas (catálogo, I1).
- **Fatia 4, Consultar: feita.** Página `/consultar` (item novo no menu;
  "Consultas" virou "Histórico de consultas") com consultas avulsas guiadas
  pelo catálogo `src/features/consult/catalog.ts`: contagem (F01), resumo
  agrupado (F02), lista (F03), dados cadastrais (F08, agora com nome
  fantasia e situação especial), histórico assíncrono (F07, salva a parte
  para acompanhar), processo por CNJ na base (F05) e atualizado no tribunal
  (F04). O tipo do identificador é reconhecido pelo formato; o resultado
  oferece "Salvar na lista" e "Monitorar". Cada chamada entra no histórico
  (novas modalidades em `QUERY_MODES`; o histórico aceita CNJ). Na
  demonstração, as respostas vêm dos dados fictícios, com selo. Ficam para
  depois: consulta processual assíncrona por CNJ (F06) com resumo por IA
  (F11), mandados (F09) e execução penal (F10).
- **Fatia 5, barra de pesquisa: feita.** Sugestões enquanto se digita
  (`src/components/layout/search-suggestions.ts`, função pura testada):
  partes salvas pelo nome ou por parte do documento (com "monitorada"),
  monitoramentos por CNJ e processos conhecidos; para um CNPJ, CPF ou CNJ
  completo e válido, o item explícito "Consultar na JUDIT", que abre a
  página Consultar já preenchida. Nada é consultado só por digitar. Busca
  por nome na JUDIT continua fora (R1: homônimos, sem nome de teste).
- **Fatia 6, monitoramentos: feita.** Coluna "Alvo" (nome da parte em
  cima, identificador embaixo; CPF mascarado) no lugar de "Identificador" e
  "Empresa"; filtro por CPF; filtro de termos nas movimentações (F21) no
  monitoramento por CNJ: o diálogo aceita até 10 termos, o banco guarda
  (`stepTerms`) e o client envia `notification_filters.step_terms` (README
  item 44: a página da JUDIT tem a frase truncada e o exemplo inválido; não
  testado ao vivo). Os e-mails da própria JUDIT (F22) ficaram de fora:
  mandam dados de processo para fora do app, decisão do usuário.
- **Fatia 7, conta na JUDIT: feita.** Cartão "Conta na JUDIT" em
  Configurações: saldo de créditos (F27) e consumo do ciclo (F28), lidos só
  por clique (a documentação não diz se as leituras são cobradas), cada um
  com o seu erro (o consumo exige chave administrativa). Serviço novo no
  client (`users.production.judit.io`, `src/lib/judit/account.ts`). O
  formato da resposta do saldo não é documentado (README item 45): a tela
  mostra os campos simples que vierem. Não testado ao vivo.
- **Fatia 8, processo no modo `db`: feita.** `/processos/[cnj]` não dá mais
  404 para um CNJ válido: mostra o monitoramento e os alertas do processo e
  busca a capa na JUDIT por clique, na base (F05) ou atualizada no tribunal
  (F04), pela mesma action da página Consultar (cada busca entra no
  histórico). CNJ inválido continua "não encontrado".
- **Fatia 9, pormenores do círculo 1: feita em parte.** Feitos: marcar os
  alertas de um monitoramento numa chamada só; "Verificar status" e filtro
  por situação no histórico de consultas; card das consultas assíncronas sem
  jargão fora da vista de suporte e com tratamento de "servidor sem
  resposta"; página da parte com "Alertas recentes" no modo `db` (a
  atividade não é gravada) e nome fantasia guardado; dados cadastrais na
  Receita em tempo real como consulta própria (on-demand); horário da
  primeira execução em UTC e em Brasília (IK5); indicadores do Dashboard
  levam às listas. Ficam: a vista de suporte nasce desligada por um instante
  (o servidor não conhece a preferência do navegador); adicionar parte na
  demonstração (lista fixa); paginação; aviso de `<Suspense>` (D5); divisão
  de componentes grandes (itens 15 e 16); conferência de entregas perdidas
  (IK10); destino do evento de saída; revisão dos textos de ajuda com o
  usuário.
- **Fatia 10, consultas assíncronas novas: feita.** Consulta processual
  completa por CNJ (F06), com resumo por IA opcional (F11, beta, custo não
  informado; o texto vem com HTML, que a tela remove em vez de
  interpretar); mandados de prisão por CPF (F09) e execução penal por CPF ou
  CNPJ (F10). Entram pela página Consultar e pelo card da página da parte;
  a consulta por CNJ não tem parte (`partyId` nulo), e a regra de "consulta
  igual em aberto" usa o CNJ. O histórico de consultas ganhou "Ver
  resultado", que abre o resultado de qualquer consulta assíncrona
  concluída num painel lateral (mandados, processos de execução e o resumo
  por IA incluídos). Nada testado ao vivo.
- **Fatia 11, pormenores restantes: feita em parte.** Feitos: a vista de
  suporte saiu do localStorage para um cookie, que o servidor lê no modo
  `db` e com isso a página já nasce com a vista certa (na demonstração,
  pré-renderizada, continua o instante desligada; quem tinha a vista ligada
  liga de novo uma vez); adicionar empresa ou pessoa na demonstração, só na
  memória da aba (a página dela é desenhada no navegador e some ao
  recarregar), inclusive pelo "Salvar na lista" da página Consultar;
  paginação de 25 linhas em monitoramentos, partes, histórico de consultas,
  alertas e diagnóstico de webhooks, com aviso quando a lista chega ao
  limite lido do banco (`src/lib/list-limits.ts`) e "+" nos números do
  Dashboard nesse caso; leituras dentro do `<Suspense>` em Empresas,
  Pessoas, Dashboard e Configurações (D5, não confirmado pelo sintoma); um
  só `<main>` por página (catálogo J2); histórico com a coluna "Alvo" e link
  para o processo nas consultas por CNJ. Ficam: divisão de componentes
  grandes (itens 15 e 16), conferência de entregas perdidas (IK10), destino
  do evento de saída e revisão dos textos de ajuda (estes dois dependem do
  usuário).
- **Fatia 12, conferência de entregas perdidas (IK10): feita.** Ao abrir o
  resultado de uma consulta com entrega por webhook, a vista de suporte
  mostra quantas respostas a JUDIT lista e quantas entregas chegaram para o
  mesmo `request_id`, com o aviso de fim (600) à parte. A comparação usa a
  lista já lida para mostrar o resultado, sem chamada nova; se faltar
  entrega, o texto diz que nada se perdeu (o resultado veio da consulta
  direta). Hipótese registrada: uma resposta, uma entrega
  (`src/features/queries/deliveries.ts`, catálogo G7). Monitoramentos ficam
  de fora: o resultado deles é lido por outra rota
  (`GET /responses/tracking`), e a relação com as entregas é a IK11.
- **Fatia 13, itens 15 e 16 da revisão técnica: feita.** Rótulos no meio de
  frases passam por `lowerFirst` (`src/lib/format.ts`), que troca só a
  primeira letra e preserva siglas: a página Consultar mostrava "Resultado:
  processo na base da judit". O card da consulta síncrona saiu da página da
  parte (`party-lawsuits-card.tsx`); o estado continua em `PartyDetail`,
  porque os indicadores do topo usam o mesmo resultado. Outras divisões de
  componentes grandes ficam para quando houver motivo além do tamanho.
- **Fatia 14, período do gráfico do Dashboard: feita.** "Alertas por dia"
  escolhe 7, 14 ou 30 dias; o indicador "Alertas" continua contando 14 dias,
  como o texto dele diz. No modo `db`, se a lista de alertas chegou ao
  limite, a descrição avisa que a contagem é sobre os mais recentes.

**Círculo 2 encerrado do lado do agente (2026-10-16).** Dependem do
usuário: destino do evento de saída, revisão dos textos de ajuda, liberar
documentos reais (S5) e os testes ao vivo de tudo o que chama a JUDIT pela
primeira vez (dados cadastrais, `step_terms`, saldo e consumo, consulta
processual por CNJ com resumo por IA, mandados, execução penal). Fora do
plano do círculo 2, candidatos ao 3: anexos (F12, F13), filtros avançados
(F14), Diário Oficial (F19), histórico da conta (F26), OAB e nome (R1),
respostas além da primeira página (item 13), login e "tomadas" do
back-end.

## Círculo 3: anotações (planejamento, 2026-10-17)

O círculo 3 ainda não foi aberto. Esta seção junta os pontos para implementar
nele; nada aqui foi decidido.

### Ponto 1: Consultar como página única, para leigos

_Ditado do usuário:_ Gostei muito da aba nova Consultar: você digita um
documento, escolhe o tipo de consulta que quer fazer nele, clica e recebe o
resultado. Achei muito intuitivo; deixa muito claro que opções você tem na
consulta de cada documento. Para essa página ficar realmente completa, a
barra de digitação deveria identificar o documento só pelo que se digita,
porque cada um tem a sua formatação e um número de dígitos muito
específico. Se dois documentos tiverem o mesmo número de dígitos, a gente dá
um jeito de diferenciar; acho que a própria documentação da JUDIT mostra
como cada documento é digitado. No momento em que o site reconhece o
documento, aparecem embaixo todas as opções de consulta que se pode fazer.
Monitoramento é outra coisa: essa aba é para consultas imediatas. Mas daria
para usar a página como uma página unificada para um leigo: você escolhe a
opção que quer consultar e marca se é monitoramento ou não, ou seja, se é um
resultado que sempre vai voltar ou uma consulta única. Seria uma grande aba
para leigo; era o que eu imaginei que o dashboard poderia ser.

_Devolução do agente (o que entendi, com crítica):_

1. **Duas ideias, não uma.** (a) Reconhecer o identificador só pela
   digitação, sem o usuário escolher o tipo, e só então mostrar as opções;
   (b) fazer da página o ponto de entrada único do leigo: "o que você quer
   saber sobre este documento?", com a escolha entre resposta única e
   acompanhamento (monitoramento).
2. **O reconhecimento já existe em parte.** `changeValue` em
   `src/features/consult/components/consult-page.tsx` troca o tipo quando o
   que foi digitado é um CPF, CNPJ ou CNJ válido (`detectDocument` em
   `src/features/parties/documents.ts`). Ele não aparece porque a tela
   começa com o seletor CNPJ/CPF/CNJ marcado em CNPJ e já mostra as opções de
   CNPJ antes de qualquer digitação. A mudança seria tirar o seletor da
   frente (no máximo um "não é isso?" para corrigir), mostrar um selo
   "Reconhecido: CPF" e só listar as opções depois do reconhecimento.
3. **Os três tipos de hoje não colidem.** CPF tem 11 dígitos, CNPJ 14
   caracteres (o alfanumérico também, como o fictício `A1B2C3D4/E5F6-68`) e
   CNJ 20 dígitos. A ambiguidade real aparece em outros dois lugares: no meio
   da digitação (os 11 primeiros dígitos de um CNPJ podem formar um CPF
   válido por acaso, e as opções pulariam de CPF para CNPJ) e nos tipos que
   ficaram fora (OAB, RJI, nome; R1). Para OAB e RJI, `src/lib/judit/guard.ts`
   já registra que a documentação não especifica o formato: antes de
   reconhecê-los, conferir a doc de novo; nome seria o que sobra quando nada
   é reconhecido, com o risco de homônimos.
4. **Consulta e monitoramento não são a mesma escolha com um interruptor.**
   O monitoramento é cobrado a cada verificação, pede a parte salva no app,
   tem recorrência (que a JUDIT gravou diferente do pedido, caso C11) e não
   existe para todas as consultas (dados cadastrais e mandados não se
   monitoram no app). Para o leigo, a diferença de custo precisa estar
   escrita na escolha ("uma vez" contra "a cada verificação"), e a opção
   "acompanhar" só deve aparecer nas consultas que têm monitoramento. Hoje o
   resultado já oferece "Monitorar" depois da consulta, o que é um começo.
5. **Sobreposição de entradas.** Hoje há quatro caminhos para começar algo:
   a barra de pesquisa do topo (que já abre Consultar preenchida),
   Consultar, "Adicionar empresa/pessoa" e "Novo monitoramento". Se
   Consultar virar a entrada do leigo, vale decidir o que acontece com os
   outros (manter como atalhos ou levar para ela).
6. **Dashboard e Consultar têm papéis diferentes.** O Dashboard mostra o que
   já existe (números, alertas); Consultar é a ação "quero saber algo". Uma
   saída é a página inicial do leigo começar pelo campo de Consultar, com o
   resumo do Dashboard embaixo, em vez de juntar as duas telas.
7. **Linguagem das opções.** Os nomes atuais ("na base", "no tribunal",
   "consulta processual completa") ainda são da JUDIT. Para o leigo, as
   opções poderiam ser perguntas ("Quantos processos?", "Quais processos?",
   "Dados da empresa", "O processo atualizado agora"), com o tempo esperado
   (o resumo por IA levou cerca de 16 minutos, README item 46).

Escolhas para quando o círculo 3 abrir: o seletor de tipo some ou fica como
correção; a página vira a inicial ou fica no menu; quais entradas continuam.

### Ponto 2: o fluxo do cliente, em duas páginas

_Ditado do usuário:_ Acho que o círculo 3 pode ser o círculo em que a gente
realmente estabelece o fluxo do cliente. Imagino um produto que mostre todas
as funcionalidades, mas de uma forma muito unificada. Na consulta, o Raio-X
Jurídico reconheceria todos os identificadores que a API da JUDIT reconhece.
O fluxo: você digita o identificador, escolhe que tipo de dado quer coletar,
como já está determinado na página Consultar, e no final clica em "fazer
consulta" ou em "fazer monitoramento". Em "fazer consulta", você recebe os
dados imediatos. Em "fazer monitoramento", você recebe os dados e deixa um
monitoramento, escolhendo as opções que a gente já dá ao cliente, como de
quanto em quanto tempo; o webhook já fica como padrão, para ser algo
realmente otimizado. Com essa página de consulta unificada, as outras abas
(empresas, pessoas físicas, histórico de consultas) podem ser recolhidas para
outro canto, mais voltado a entender o que você está fazendo no aplicativo do
que a fazer. O Dashboard também se recolhe, e a gente delibera: se há uma
página unificada para fazer as consultas, qual é a página unificada para
verificar os resultados, o que você sabe, o que não sabe, o que pediu, o que
não pediu, as informações que você recebeu. É um fluxo duplo: uma página
muito simples para consultar e colocar um monitoramento, e uma página para
verificar todos os dados, com um bom fluxo. O que não podemos fazer é o que
já foi feito: muitas coisas que acumulam funções. No Dashboard dá para criar
um monitoramento, mas não faz sentido, porque ele é para dar informação. Há
abas de empresas e pessoas físicas, de monitoramentos e de histórico de
consultas, e todas têm informações que se sobrepõem; às vezes, para
consultar uma coisa, dá para fazer de três maneiras diferentes. O aplicativo
já tem poucas funcionalidades; se continuarmos sobrepondo, vai ficar muito
feio. Então proponho uma página unificada de pesquisa, com as consultas, e
uma página unificada para ler as informações que você já pesquisou e
entender o que você fez na aplicação até hoje.

_Devolução do agente (o que entendi, com crítica):_

1. **A proposta.** O app passa a ter duas páginas principais: **Pesquisar**
   (fazer: identificador → tipo de dado → "consultar" ou "monitorar") e
   **Acompanhar** (ler: tudo o que foi pedido e recebido). Empresas, Pessoas,
   Histórico de consultas e Dashboard deixam de ser portas de entrada e vão
   para um canto secundário. A regra que o ditado estabelece: **cada página
   tem uma função**, e nenhuma ação aparece em página de leitura. Isso
   substitui o ponto 1, item 5 (as quatro entradas).
2. **Ambiguidade a resolver.** O "outro canto" (empresas, pessoas,
   histórico) e a página de "verificar os resultados" são a mesma coisa ou
   duas? Leitura do agente: são a mesma página, com níveis. Por exemplo, em
   cima as novidades (alertas), embaixo a lista de assuntos (cada pessoa,
   empresa ou processo), e cada assunto abre uma ficha com tudo o que se
   sabe dele: consultas feitas, resultados, monitoramentos ativos, alertas. O
   "o que você não sabe" poderia ser, na ficha, as consultas que ainda não
   foram feitas para aquele assunto. Isso é interpretação, não ditado.
3. **"Fazer monitoramento" não devolve os dados de agora.** Fato observado na
   etapa 4 (catálogo C14, README item 37): o monitoramento por documento só
   avisa processos distribuídos **depois** da criação, e a primeira execução
   pode levar até um dia. "Receber os dados e deixar um monitoramento" são,
   então, duas chamadas cobradas: uma consulta agora e um monitoramento
   daqui para frente. A tela precisa dizer isso, ou o cliente vai esperar o
   retrato atual vindo do monitoramento.
4. **Nem todo tipo de dado tem monitoramento.** A JUDIT monitora quatro
   coisas (mapa de funcionalidades, F17 a F20): movimentações de um processo
   (CNJ), processos novos de um documento (CPF, CNPJ, OAB), Diário Oficial e
   filtros sem documento. Dados cadastrais, contagem, mandados e execução
   penal não se monitoram. O botão "monitorar" só aparece onde existe, e o
   texto diz o que será acompanhado (que não é o mesmo dado da consulta).
5. **Recorrência como opção.** A JUDIT gravou recorrência 1 nas duas vezes em
   que pedimos 30 (caso C11, pergunta IK1). Oferecer "de quanto em quanto
   tempo" pode prometer o que a conta não cumpre. Até a IK1 ter resposta, a
   tela mostra o que a JUDIT gravou, como já faz o aviso da criação.
6. **Webhook como padrão.** Faz sentido e resolve o caso K3 (o status só
   muda quando alguém clica). Depende de uma URL pública
   (`JUDIT_WEBHOOK_PUBLIC_ORIGIN`): na máquina local, sem túnel, não há como
   receber. Então o padrão é "webhook quando há URL pública, consulta
   periódica quando não há", com a tela dizendo qual está valendo.
7. **Todos os identificadores.** Entram OAB, nome e RJI (número do BNMP, só
   para mandados), além de CPF, CNPJ e CNJ. Três cuidados: a documentação
   não especifica o formato de OAB nem de RJI (`src/lib/judit/guard.ts`),
   então o reconhecimento pela digitação precisa de fonte antes; nome não
   tem formato (é o que sobra quando nada é reconhecido) e traz homônimos;
   não há documento de teste para OAB, nome e RJI, então o teste ao vivo
   depende de dados reais seus e da allowlist por variável de ambiente.
8. **A página de leitura esbarra numa decisão de banco.** Hoje as consultas
   síncronas guardam **só metadados** (`sync_queries`): o resultado aparece e
   não é gravado, por minimização de dados. Os resultados assíncronos são
   lidos de novo na JUDIT ao abrir (custo não documentado). "Ver tudo o que
   recebi" pede uma escolha: gravar os resultados (mais dado pessoal e
   processual no banco) ou buscar de novo quando abrir (mais chamadas, talvez
   cobradas). É decisão de desenho de dados, para discutir antes do código.
9. **Custo para o fechamento.** É uma reestruturação de navegação, não um
   pormenor. Até a separação dos dois produtos, o modo de demonstração
   também precisa funcionar nas páginas novas. Uma saída é fazer o círculo 3
   só no modo `db` e adaptar o protótipo na separação; decidir quando o
   círculo abrir.

Escolhas para quando o círculo 3 abrir, somadas às do ponto 1: o "canto
secundário" e a página de leitura são uma página ou duas; gravar resultados
ou buscar de novo; o que acontece com o Dashboard (vira o topo da página de
leitura ou some); o modo de demonstração acompanha agora ou na separação.

### Ponto 3: digitar uma vez, a barra de pesquisa e o círculo 4

_Ditado do usuário:_ Sim, quando digo monitorar e trazer os dados ao mesmo
tempo, estou falando de duas chamadas. Isso a gente pode deliberar. Às vezes
o que interessa é ver os dados e deixar o monitoramento. Na aba Consultar
poderíamos deixar só "consultar" e "novo monitoramento"; ou, ao clicar em
"novo monitoramento", aparece uma janelinha perguntando se você quer receber
também os dados de agora. Penso no fluxo: a pessoa escreve o CPF e consulta,
mas ao mesmo tempo queria monitorar, para saber se houver alguma alteração;
hoje ela teria que digitar o CPF de novo. Queria que a pessoa só precisasse
digitar uma vez. Mas isso é secundário, deliberamos depois.

O botão "monitorar" só aparece onde existe, e é por isso que acho importante
a consulta entender o que pode fazer por você a partir do momento em que
você digita o documento. Na aba Consultar, só há a janelinha para escrever o
documento, e ela reconhece o que pode te dar a partir dele. Gostei da
interpretação do agente sobre a ambiguidade (o canto secundário e a página
de leitura são uma página só, em níveis).

Na aba Consultar não haveria a barrinha de pesquisa que existe no site todo;
ela só aparece nas suas informações de dados. O que ela procura é, por
exemplo, se aquele CPF você já consultou: é um jeito fácil de acessar as
suas consultas. Você digita um CPF e aparece primeiro a consulta que você já
fez sobre ele, com a data, para reacessar; e, em segundo, com pouca
opacidade, "criar consulta", porque às vezes a pessoa está na aba errada.
Essa barrinha poderia ser realmente funcional. Todas essas mudanças
deixariam o fluxo do site bem melhor, e conseguiríamos terminar o front do
cliente rapidinho: um produto simples para quem acessa, mas com todas as
funcionalidades que se poderia pedir de algo que usa a API da JUDIT.

No círculo 4, entenderíamos as funções de suporte do aplicativo, quais
informações precisam estar nas Configurações e o que queremos dizer com
integração com a conta. Não sei se a vista de suporte é tão útil, dado que
não tem tantas funções: há a página de diagnóstico de webhooks, aparece o
banco de dados, umas legendas a mais. Se for para ter um modo desenvolvedor,
que tenha coisas novas a fazer; se não tiver, tudo bem apagá-lo e deixar o
diagnóstico de webhooks no lugar. Isso fica para o círculo 4; antes, vamos
nos manter no que queremos dizer com o círculo 3.

_Devolução do agente (o que entendi, com crítica):_

1. **Direção aceita:** a interpretação do ponto 2, item 2, vale como rumo:
   a página de leitura e o canto secundário são uma página só, em níveis
   (novidades, assuntos, ficha de cada assunto).
2. **Digitar uma vez (secundário, a deliberar).** As duas saídas do ditado
   servem, e nenhuma pede redigitar: (a) o resultado da consulta oferece
   "Monitorar" já preenchido (hoje existe, depois da consulta); (b) o
   diálogo de monitorar tem "receber também os dados de agora", deixando
   escrito que são duas cobranças. A (b) cobre o caso "quero os dois" num
   clique só; a (a) cobre "vi o resultado e decidi acompanhar". Podem
   conviver.
3. **Consultar só com o campo.** Coerente com o ponto 1: sem seletor de
   tipo, sem opções antes do reconhecimento.
4. **A barra de pesquisa muda de papel.** Hoje (fatia 5,
   `src/components/layout/search-suggestions.ts`) ela procura partes
   salvas, monitoramentos e processos conhecidos, e oferece "Consultar na
   JUDIT". No ditado, ela vira a busca da página de leitura: procura
   **consultas já feitas** pelo identificador (com a data) e, por último e
   discreta, "criar consulta", que leva a Consultar já preenchida. Duas
   consequências: ela some da página Consultar (a barra está no cabeçalho,
   comum a todas as páginas, então a visibilidade passa a depender da rota);
   e "reacessar a consulta" esbarra na decisão do ponto 2, item 8: hoje uma
   consulta síncrona reaberta mostra só os metadados (data, tipo,
   quantidade), porque o resultado não é gravado.
5. **"Terminar rapidinho".** O desenho é simples para quem usa, mas três
   pontos pesam no tamanho: a decisão de gravar resultados (ponto 2, item
   8), os formatos de OAB e RJI sem fonte (ponto 2, item 7) e o modo de
   demonstração nas páginas novas (ponto 2, item 9). Resolver os três antes
   do código deixa o círculo 3 curto.
6. **Círculo 4 (só registrado).** Fato para a discussão: a vista de suporte
   hoje mostra o item Diagnóstico no menu, identificadores técnicos
   (`request_id`, status da JUDIT), a conferência de entregas por webhook e
   textos a mais; ela é lida em 11 arquivos de `src`. Pesa a favor de
   mantê-la que o catálogo de falhas é um objetivo do projeto, e a vista é
   onde o suporte enxerga a falha; pesa contra que ela tem pouca coisa
   própria.

## Círculo 3: proposta consolidada (2026-10-17)

Junta os pontos 1 a 3 (acima), a pedido do usuário: primeiro o que ele disse,
por tema e em texto do agente; depois a crítica; depois as decisões que vêm
antes do código; por fim, as fatias. Nada aqui foi decidido.

### A. O que foi dito, por tema

1. **Objetivo do círculo.** Estabelecer o fluxo do cliente: um produto
   simples para quem usa, que mostre todas as funcionalidades da API da
   JUDIT de forma unificada, e permita terminar rápido o front do cliente.
2. **Regra geral.** Cada página tem uma função. Nada de páginas que acumulam
   funções nem de três caminhos para a mesma coisa (exemplo citado: criar
   monitoramento a partir do Dashboard, que é uma página de informação).
3. **Página de pesquisa (fazer).** Só um campo. O app reconhece, pelo que foi
   digitado, qualquer identificador que a API da JUDIT aceita, e diferencia
   os que tiverem o mesmo número de dígitos. Reconhecido o identificador,
   aparecem as consultas possíveis para ele. A pessoa escolhe o tipo de dado
   e clica em "consultar" (dados imediatos) ou "monitorar" (acompanhamento
   com as opções que o app já oferece, como a frequência, e webhook como
   padrão). "Monitorar" só aparece onde existe.
4. **Consultar e monitorar juntos.** São duas chamadas, de propósito: muitas
   vezes a pessoa quer ver os dados agora e deixar o acompanhamento. Ela não
   deve precisar digitar o identificador duas vezes. Duas formas possíveis:
   botões separados, ou o diálogo de monitorar perguntando se ela quer os
   dados de agora também. Secundário; decidir depois.
5. **Página de leitura (ver).** Uma página para verificar tudo o que se
   sabe: o que foi pedido, o que foi recebido, o que ainda não se sabe, e
   entender o que se fez no app até hoje. Empresas, Pessoas, Histórico de
   consultas e o Dashboard deixam de ser páginas próprias e se recolhem
   nela. Aceita a leitura do agente: uma página só, em níveis (novidades,
   assuntos, ficha de cada assunto).
6. **Barra de pesquisa.** Some da página de pesquisa e fica só na de leitura.
   Ela procura o que já foi consultado: digitado um CPF, aparece primeiro a
   consulta já feita sobre ele, com a data, para reabrir; por último, em
   destaque menor, "criar consulta", para quem está na página errada.
7. **Fora do círculo 3 (círculo 4).** Funções de suporte, o que vai nas
   Configurações, o que significa "integração com a conta" e se a vista de
   suporte continua (se não ganhar funções próprias, pode sair, deixando o
   diagnóstico de webhooks no lugar).

### B. Crítica

1. **A proposta é boa e resolve o problema certo.** O app tem poucas
   funções e já tem entradas sobrepostas (barra do topo, Consultar,
   "Adicionar empresa/pessoa", "Novo monitoramento", ações no Dashboard).
   Duas páginas com funções separadas reduzem a navegação a uma pergunta:
   "quero saber algo novo" ou "quero ver o que já sei".
2. **O "assunto" deixa de ser só empresa ou pessoa.** Com OAB, nome, CNJ e
   RJI, a página de leitura precisa agrupar por identificador, não pela
   coleção `parties` (que só tem CPF e CNPJ). Isso muda o modelo mental do
   app: a unidade passa a ser "o que eu pesquisei", não "quem eu cadastrei".
3. **Ver o que já recebi exige guardar ou buscar de novo.** Hoje a consulta
   síncrona grava só metadados (`SyncQuery` em `src/db/models.ts`: tipo,
   chave, resultado, quantidade, erro). A assíncrona é relida na JUDIT a
   cada abertura (`listResponses` em `src/features/queries/actions.ts`,
   custo não documentado). A página de leitura só cumpre a promessa se essa
   escolha for feita (decisão D1). É a decisão mais pesada do círculo.
4. **Reconhecer todos os identificadores tem um caso real de colisão.** CPF
   (11 dígitos), CNPJ (14 caracteres) e OAB (número e UF, com letras e
   curta) se separam pelo formato. Mas o único exemplo de RJI tem 20
   dígitos, como o CNJ (README item 47). O CNJ tem dígito verificador; o
   RJI, até onde a documentação diz, não. Regra possível: 20 dígitos com
   verificador de CNJ válido = CNJ; inválido = RJI, com um "não é isso?"
   para corrigir. O formato da OAB também não é definido (UF antes ou
   depois, README item 47): aceitar as duas formas e normalizar fica como
   hipótese a testar. Nome é o que sobra quando nada é reconhecido.
5. **Monitorar não devolve o retrato atual** (catálogo C14): por isso as
   duas chamadas do tema 4 são necessárias, e a tela deve dizer que são
   duas cobranças. Nem todo dado tem monitoramento: a JUDIT monitora
   processo (CNJ), processos novos de documento (CPF, CNPJ, OAB), Diário
   Oficial e filtros sem documento (mapa, F17 a F20). Contagem, cadastro,
   mandados e execução penal, não.
6. **Webhook como padrão tem um pré-requisito e uma lacuna.** Precisa de
   URL pública (`JUDIT_WEBHOOK_PUBLIC_ORIGIN`); sem ela, a verificação
   periódica continua. E o monitoramento criado pelo app hoje não envia
   `callback_url`: o client só tem o `PATCH` depois da criação
   (`updateTrackingCallbackUrl` em `src/lib/judit/tracking.ts`). Ligar o
   webhook nos monitoramentos é trabalho novo, e a entrega real precisa ser
   testada.
7. **Frequência como opção.** A JUDIT gravou 1 nas duas vezes em que
   pedimos 30 (C11). Até a IK1 ter resposta, oferecer a escolha promete o
   que talvez não aconteça; a tela pode mostrar o que a JUDIT gravou.
8. **"Terminar rápido" depende das decisões, não do código.** Com D1 a D7
   resolvidas, as fatias são diretas; sem elas, o círculo vira idas e
   voltas.

### C. Decisões antes do código

| #   | Decisão                                           | Opções                                                                                                                                        | Recomendação do agente                                                                                                                                                                                              |
| --- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D0  | Documentos reais nos testes                       | (A) allowlist extra no `.env.local`; (B) `JUDIT_ALLOWLIST=disabled`                                                                           | A: o documento fica fora do Git e o modo restrito continua                                                                                                                                                          |
| D1  | O que a página de leitura mostra de cada consulta | (a) só metadados, reabrir = consultar de novo; (b) gravar o resultado já tratado (o que a tela mostra), sem o payload cru; (c) reler na JUDIT | b, com campos listados por tipo de consulta, botão "apagar este assunto" e o cadastro (endereços, contatos) fora do que se grava. Muda a regra de minimização de dados: decisão sua                                 |
| D2  | O que é um "assunto"                              | (a) só partes (CPF, CNPJ); (b) qualquer identificador pesquisado (tipo e chave), com o nome da parte quando houver                            | b: agrupar pelo histórico, sem coleção nova; `parties` continua dando nome às empresas e pessoas                                                                                                                    |
| D3  | Identificadores novos                             | OAB, nome, RJI: todos, alguns ou nenhum agora                                                                                                 | OAB e nome, com aviso de homônimo no nome; RJI só nos mandados. Teste ao vivo com dados seus (depende de D0)                                                                                                        |
| D4  | Consultar e monitorar sem redigitar               | (a) "Monitorar" no resultado; (b) "receber também os dados de agora" no diálogo; (c) as duas                                                  | c, com as duas cobranças escritas. Secundário, como o usuário disse                                                                                                                                                 |
| D5  | Página inicial e páginas antigas                  | "/" = pesquisa ou leitura; antigas somem ou redirecionam                                                                                      | "/" = pesquisa (é a ação do leigo), com uma linha "N novidades" levando à leitura; Dashboard, Empresas, Pessoas, Histórico e Monitoramentos viram partes da leitura, e as rotas antigas redirecionam                |
| D6  | Webhook nos monitoramentos                        | (a) agora; (b) no círculo 4                                                                                                                   | a, só quando houver URL pública, com a tela dizendo como o resultado chega                                                                                                                                          |
| D7  | Modo de demonstração                              | (a) acompanha cada fatia; (b) só o modo `db` agora, demonstração na separação                                                                 | a, com o mínimo: as consultas que já têm dados fictícios funcionam, as novas (OAB, nome, RJI) dizem "indisponível na demonstração". Sem isso, o app quebra no modo `demo` até a separação, e o protótipo nasce dele |

### D. Como implementar (fatias, depois das decisões)

1. **Reconhecimento de identificadores.** Uma função pura (perto de
   `detectDocument` em `src/features/parties/documents.ts`) que recebe o
   texto e devolve o tipo reconhecido, ou a lista de candidatos quando há
   dúvida (CNJ ou RJI). Testes com cada formato, com a colisão e com a
   digitação pela metade (os 11 primeiros dígitos de um CNPJ). Sem
   chamada à JUDIT.
2. **Catálogo ampliado.** Cada consulta de `src/features/consult/catalog.ts`
   passa a dizer os identificadores aceitos (com OAB, nome e RJI onde a
   JUDIT aceita), se tem monitoramento equivalente e o que ele acompanha, e
   um texto curto de tempo e custo. As opções viram perguntas ("Quantos
   processos?", "Dados da empresa").
3. **Página de pesquisa.** Só o campo; selo "Reconhecido: …" com "não é
   isso?"; opções depois do reconhecimento; "Consultar" e, onde existe,
   "Monitorar"; resultado com "Monitorar" já preenchido (D4). Sem a barra
   do cabeçalho.
4. **Gravar o que a leitura vai mostrar (conforme D1).** Mudança no modelo
   de dados, com índice e testes, separada da tela.
5. **Página de leitura.** Topo: novidades (alertas) e os números do
   Dashboard. Meio: assuntos (D2), com filtro por tipo e "monitorado".
   Ficha do assunto: consultas feitas com data, resultados (D1),
   monitoramentos, alertas e as consultas ainda não feitas. A barra de
   pesquisa vive aqui: consultas já feitas primeiro, "criar consulta"
   discreto por último.
6. **Webhook nos monitoramentos (D6)** e o texto de como cada resultado
   chega.
7. **Limpeza.** Menu com duas entradas (mais Configurações e, enquanto a
   vista de suporte existir, Diagnóstico); rotas antigas redirecionam (D5);
   ações retiradas das páginas de leitura; textos de ajuda revistos.

Ordem pensada para que cada fatia funcione sozinha: 1 e 2 não mudam a tela;
3 troca a página de pesquisa; 4 e 5 trocam a leitura; 6 e 7 fecham.

### Respostas do usuário à proposta (2026-10-17)

_Ditado do usuário:_ Lembro que, num momento antigo do projeto, eu disse que
não fazia muito sentido ter um banco de dados próprio, já que existia o
datalake da JUDIT. Hoje acho que faz total sentido ter banco próprio; tem que
ter. A consulta que a gente faz tem que ir para dentro do MongoDB.

Sobre a colisão entre CNJ e RJI, faz sentido a forma de decidir se é um ou
outro. Mas penso também que, mesmo com 20 dígitos, às vezes há letras e
números numa ordem diferente; acho muito difícil terem feito 20 dígitos
exatamente na mesma formatação de outro documento.

Quero conseguir abrir o aplicativo neste momento de teste e fazer consultas
com documentos reais. Não quero a allowlist ativada agora: se já temos uma
medida de segurança que impede que eu gaste todos os meus créditos e fique
sem conseguir testar, não faz sentido a allowlist me impedir de consultar.

E não podemos mais guardar só o mínimo de dados. Temos que guardar tudo, já
normalizado, como se o nosso banco pudesse pegar o dado que recebeu da JUDIT
e usá-lo para si próprio, e só mudá-lo quando houver alguma atualização
naquele dado. Fora esses comentários, gostei das recomendações e do
seccionamento das fatias.

Para ser explícito sobre como imagino o site: com duas páginas principais,
não faz sentido a barra vertical da esquerda com todas as telas, porque
nunca vamos preenchê-la; serão pouquíssimas páginas. Ela vira uma barra
horizontal no topo da tela. No canto superior esquerdo, o logo, o nome da
página em que você está e os dois botões para trocar entre as páginas: um
leva a "consultas", o outro a "informações das consultas", e você só
alterna entre uma e outra, como quando se troca de workspace no Linux (1,
2), mas com o nome mudando junto. No meio, a barra de pesquisa. No canto
direito, os alertas, as configurações e a conta.

A barra de pesquisa pode ficar em todas as telas, como uma pesquisa simples
e unificada. Há dois fluxos que exigem procurar com atenção: ir à página de
fazer consulta ou à página de pesquisar as informações do seu banco. Na
barra, você só digita e tem um acesso muito fácil, para quem está com
pressa.

_Devolução do agente (o que entendi, com crítica):_

1. **D1 decidido: gravar tudo, normalizado.** Isso **reverte uma decisão
   registrada**: na etapa 3 (diário, "Desenho da fatia 3: híbrido",
   2026-10-14) o usuário decidiu não copiar processos para o MongoDB, e a
   IK0 reforçou o desenho híbrido. A razão de então era não replicar a
   JUDIT; a de agora é que o app passa a ter uma base própria, que a página
   de leitura usa. Consequências a desenhar na fatia 4: (a) "normalizado"
   quer dizer coleções do nosso formato, uma por coisa (processos por CNJ,
   cadastros por documento, mandados, execuções), e não o corpo cru da
   resposta; (b) "só mudar quando houver atualização" pede regra de
   atualização: substituir pelo dado mais novo, guardando de onde veio
   (`request_id`, data, base ou tribunal), já que a JUDIT não manda uma
   versão; (c) sem monitoramento, o dado só envelhece, então a tela mostra
   "consultado em"; (d) mais dado pessoal e processual de terceiros no
   banco: o botão "apagar este assunto" e o cuidado com processos em
   segredo de justiça continuam.
2. **D0 decidido: allowlist desligada agora.** Não pede código:
   `JUDIT_ALLOWLIST=disabled` no `.env.local` (`allowlistEnabled` em
   `src/lib/judit/guard.ts`), que o usuário edita. Ficam valendo o limite
   por minuto (30) e o teto diário (50), contados por nós. Um cuidado
   concreto: o teto conta a criação de um monitoramento, não as execuções;
   um monitoramento real de CPF é cobrado pela JUDIT a cada execução até ser
   pausado.
3. **RJI e letras.** A hipótese do usuário (o RJI teria letras e números
   numa ordem própria) é plausível, mas a documentação só mostra 20 zeros
   (README item 47). Sem fonte, a regra do reconhecimento fica: CNJ válido
   = CNJ; 20 caracteres que não são CNJ = candidato a RJI, com "não é
   isso?". Se o RJI tiver letras, ele se separa sozinho do CNJ, que é só
   número. Pergunta registrada no diário (IK15).
4. **Navegação no topo, sem a barra lateral.** Três zonas: esquerda (logo,
   nome da página, alternância 1 e 2 entre "Consultar" e "Minhas
   informações"), meio (barra de pesquisa), direita (alertas,
   configurações, conta). Observações: (a) o nome da página e a alternância
   dizem a mesma coisa; a alternância com o nome destacado já resolve; (b)
   "conta" ainda não existe: não há login (círculos 3 ou 4) e "Conta na
   JUDIT" está nas Configurações; até lá, o canto direito pode ter só
   alertas e configurações; (c) no celular, as três zonas não cabem: a
   barra de pesquisa vira um ícone; (d) Diagnóstico, enquanto existir, fica
   dentro de Configurações (decisão do círculo 4).
5. **Barra de pesquisa em todas as páginas** (substitui o tema 6 da
   proposta consolidada). Ela vira o atalho para as duas páginas: digitado
   um identificador, mostra primeiro o que já está no banco e, em seguida,
   "consultar", que leva à página de pesquisa já preenchida. Um conflito: na
   página Consultar haveria dois campos para a mesma coisa (o da barra e o
   da página). Saída proposta: nessa página, digitar na barra preenche o
   campo da página, em vez de abrir sugestões.

Decisões atualizadas: D0 = B (allowlist desligada, pelo `.env.local`); D1 =
gravar tudo, normalizado; D2 a D7 seguem a recomendação. Fatias como na
proposta consolidada, com a navegação no topo dentro da fatia 7 (ou antes,
se for melhor ver a forma nova cedo).

## Círculo 3: plano de implementação (2026-10-17)

Decisões em vigor: D0 = allowlist desligada pelo `.env.local` (feito pelo
usuário; limites de 30 por minuto e 50 por dia continuam); D1 = gravar tudo,
normalizado, no MongoDB; D2 a D7 pela recomendação da proposta consolidada.
Cada fatia termina com testes, lint, typecheck, format e build, e um commit
próprio. Os testes ao vivo são do usuário, com documento próprio; o agente
registra os resultados sem o número do documento.

1. **Reconhecimento de identificadores.** Função pura, sem tela e sem
   JUDIT, que recebe o texto digitado e devolve o tipo reconhecido, um
   estado "incompleto" ou a lista de candidatos quando há dúvida. Tipos:
   CPF (11 dígitos com verificador), CNPJ (14 caracteres, numérico ou
   alfanumérico, com verificador), CNJ (20 dígitos com verificador), RJI
   (20 caracteres que não formam um CNJ válido; IK15), OAB (número e UF,
   nas duas ordens; README item 47) e nome (o que sobra, com tamanho
   mínimo). Testes de cada formato, da colisão CNJ/RJI e da digitação pela
   metade. Substitui `detectDocument` onde ele decide o tipo.
2. **Catálogo ampliado.** Cada consulta de `src/features/consult/catalog.ts`
   passa a declarar os identificadores que a JUDIT aceita para ela (com
   OAB, nome e RJI onde a documentação diz), o monitoramento equivalente
   (se existe e o que acompanha), a pergunta que a representa para o leigo
   ("Quantos processos?") e um texto curto de tempo e custo. Os tipos novos
   entram nos tipos de busca do app e no client, conferidos página a página
   na documentação antes de cada chamada nova.
3. **Navegação no topo.** Sai a barra lateral. Barra horizontal com três
   zonas: à esquerda, logo e a alternância "Consultar" / "Minhas
   informações" (a ativa com o nome destacado); no meio, a barra de
   pesquisa; à direita, alertas e Configurações (a "conta" espera o login).
   Diagnóstico entra em Configurações enquanto a vista de suporte existir
   (círculo 4). No celular, a pesquisa vira ícone. Até a fatia 6, "Minhas
   informações" leva às páginas atuais.
4. **Página Consultar nova** ("/" passa a ser ela, D5). Só o campo; selo
   "Reconhecido: …" com "não é isso?"; as perguntas possíveis para aquele
   identificador; botões "Consultar" e, onde existe, "Monitorar". O
   diálogo de monitorar tem "receber também os dados de agora", com as duas
   cobranças escritas; o resultado da consulta tem "Monitorar" já
   preenchido (D4). Monitoramento por OAB entra se a fatia 2 confirmar na
   documentação.
5. **Base própria (D1).** Coleções novas no nosso formato, uma por coisa:
   processos (chave CNJ), dados cadastrais (chave tipo e documento),
   mandados e execuções penais, com a ligação "encontrado ao pesquisar tal
   identificador". Gravadas a partir das consultas síncronas, dos
   resultados assíncronos e das entregas de webhook. Regra de atualização:
   o dado mais novo substitui o anterior, guardando a origem (`request_id`,
   data, base ou tribunal). Índices únicos para não duplicar; testes num
   MongoDB temporário. Processos em segredo de justiça e contatos do
   cadastro: o desenho da fatia diz o que se grava e por quê, antes do
   código.
6. **Página Minhas informações** (D2). Topo: novidades (alertas) e os
   números do Dashboard. Meio: assuntos (cada identificador pesquisado,
   com o nome quando houver), com filtros por tipo e "monitorado". Ficha do
   assunto: consultas com data, dados da base própria com "consultado em",
   monitoramentos, alertas, consultas ainda não feitas e "apagar este
   assunto". As rotas antigas (Dashboard, Empresas, Pessoas, Histórico,
   Monitoramentos, Alertas, Processo) redirecionam ou viram a ficha.
7. **Barra de pesquisa unificada.** Em todas as páginas: primeiro o que já
   está no banco (assuntos e consultas, com data), por último "Consultar",
   que abre a página Consultar preenchida. Na página Consultar, digitar na
   barra preenche o campo da página.
8. **Webhook nos monitoramentos (D6).** Quando houver URL pública
   (`JUDIT_WEBHOOK_PUBLIC_ORIGIN`), o monitoramento criado pelo app recebe
   o `callback_url` (conferir na documentação se vai na criação ou só pelo
   `PATCH`); a tela diz como cada resultado chega. A entrega real depende
   de túnel e do usuário.
9. **Limpeza e demonstração (D7).** Componentes e ações que ficaram sem
   uso saem; textos de ajuda revistos; modo de demonstração funcionando
   nas páginas novas com os dados fictícios que já existem, e "indisponível
   na demonstração" para OAB, nome e RJI. Conferência de todas as páginas
   nos dois modos.

Fora do círculo 3: login e "tomadas" do back-end, o destino da vista de
suporte e o que vai em Configurações (círculo 4); anexos, filtros avançados,
Diário Oficial e histórico da conta (candidatos já listados). Depois do
círculo 3 (ou do 4), o fechamento da etapa 7: os dois produtos separados.

## Implementação do círculo 3 (2026-10-17)

Registro por fatia, na ordem do plano. Decisões tomadas pelo agente durante a
implementação ficam marcadas como _decisão do agente_.

1. **Reconhecimento de identificadores** (`src/features/consult/identify.ts`).
   `identify(texto)` devolve `empty`, `incomplete` (o que ainda pode estar
   sendo digitado), `invalid` (tamanho certo, verificador errado) ou
   `recognized` (candidatos: o primeiro é o reconhecido; os outros vão para
   "não é isso?"). `parseSearchKey(tipo, texto)` é a mesma regra para o
   servidor. Tipo novo `SearchType` em `src/db/models.ts` (cpf, cnpj, cnj,
   oab, name, rji). `detectDocument` saiu; a página Consultar e a barra de
   pesquisa usam `identify`. _Decisões do agente:_ com máscara (`/` de CNPJ,
   `NNNNNNN-DD.` de CNJ, `NNN.NNN` de CPF), o tipo segue a máscara mesmo pela
   metade; sem máscara, 11 dígitos que formam um CPF válido são CPF (ao
   digitar o 12º, deixam de ser); um CNJ válido traz RJI como alternativa;
   20 dígitos que não formam CNJ são RJI, com uma nota dizendo que, se era um
   processo, o número está errado; OAB aceita as duas ordens e o prefixo
   "OAB", com UF válida, e é gravada como número + UF (hipótese, README
   item 47); nome pede ao menos 5 caracteres e traz a nota de homônimos.
2. **Catálogo ampliado** (`src/features/consult/catalog.ts`). Cada consulta
   declara `searchTypes` (conferidos em 2026-10-17 nas páginas count,
   cache-grouped, hotstorage, registration-data, request-document, warrant e
   criminal-execution), `question` (a pergunta para o leigo), `timing`
   (tempo e custo) e `tracking` (o monitoramento equivalente e o que ele
   acompanha; `trackingFor` diz se vale para o identificador). Documentado:
   o monitoramento por documento aceita cpf, cnpj e oab
   (tracking/tracking-document), então o monitoramento por OAB entra na
   página nova (fatia 4). `QuerySearchType` passou a ser `SearchType` (registros antigos
   continuam válidos); `isDocumentType` separa o que tem parte salva.
   `createRequest` aceita `rji`. Consultas assíncronas por OAB, nome, RJI e
   CNJ (execução penal) são criadas sem parte e acompanhadas no histórico.
   _Decisões do agente:_ contagem sem CNJ e sem RJI (a JUDIT aceita, mas
   contar processos de um processo não informa, e D3 deixa o RJI só nos
   mandados); dados cadastrais on-demand só por CPF e CNPJ (a página não diz
   se o on_demand vale para nome); por nome, a tela mostra o primeiro
   cadastro devolvido.
3. **Navegação no topo.** A barra lateral saiu (`app-sidebar.tsx` removido).
   `AppHeader` tem três zonas: marca e a alternância "1 Consultar / 2 Minhas
   informações" (a ativa destacada; no celular, sem os números e com
   "Informações"); a barra de pesquisa no meio; alertas e Configurações à
   direita. O título da página e o "i" de ajuda aparecem ao lado da
   alternância fora das duas páginas principais. Diagnóstico de webhooks
   virou um botão no card "Vista de suporte" das Configurações. Até a fatia
   6, "Minhas informações" leva ao Dashboard, com abas provisórias
   (`info-subnav.tsx`: Resumo, Empresas e pessoas, Monitoramentos,
   Histórico). No celular, a pesquisa é um ícone que abre uma linha embaixo
   do cabeçalho. Conferido com capturas de tela (1400 px e 390 px).
   _Decisão do agente:_ o menu de perfil ("Sem login") saiu; volta com o
   login (círculo 4).
4. **Página Consultar nova, em "/"** (D5). `src/app/(app)/page.tsx` é a
   página Consultar; o Dashboard foi para `/informacoes` (Minhas
   informações, até a fatia 6); `/consultar` redireciona para "/" pelo
   `next.config.ts`, mantendo `?valor=`. A página tem só o campo: o selo
   "Reconhecido: …" com a descrição do tipo, "Não é isso?" quando há
   alternativas (CNJ válido ou RJI), a nota de homônimos ou de CNJ inválido
   e o aviso de parte já salva. Reconhecido o identificador, aparecem as
   perguntas do catálogo (com a modalidade da JUDIT embaixo, "Na hora" ou
   "Depois", "Monitorável" e tempo e custo), o botão "Consultar" e, onde
   existe, "Monitorar", com a frase das duas cobranças. Monitorar abre o
   diálogo com o identificador travado (sem redigitar) e a opção "Receber
   também os dados de agora" (D4), que faz a consulta escolhida depois de o
   monitoramento ser aceito; o resultado também tem "Monitorar". O
   monitoramento por OAB entrou (modelo, validação pela mesma regra de
   `identify`, sem parte, e no diálogo como quarta opção). Conferido com
   capturas de tela.
5. **Base própria (D1)** (`src/features/base/`). Desenho, antes do código:
   - **Coleções novas**, uma por coisa: `lawsuits` (chave CNJ + instância;
     as execuções penais entram aqui com `kind: "execution"`, porque têm o
     formato de processo), `registrations` (chave tipo + documento do
     próprio cadastro), `warrants` (chave `code`, ou `number` sem código),
     `lawsuit_stats` (contagem e resumo agrupado, por identificador) e
     `findings` (a ligação "encontrado ao pesquisar tal identificador", com
     o lado do documento no processo). Índices únicos em todas.
   - **O que se grava:** os campos que o app usa, já normalizados, e o item
     inteiro como a JUDIT mandou (`juditData`), sem o envelope da resposta.
     "Tudo, normalizado" (decisão do usuário) virou isto: a estrutura é a
     nossa, e nada do conteúdo se perde.
   - **Regra de atualização:** o conteúdo mais novo (`fetchedAt`: a data da
     resposta da JUDIT, ou a da gravação) substitui o anterior, com a origem
     (`source`: síncrona, assíncrona, monitoramento ou webhook; modalidade;
     `request_id` ou `tracking_id`). É atômica: o upsert só casa com um
     registro mais velho, e o índice único recusa o resto. O resumo por IA
     só é trocado por outro resumo.
   - **Segredo de justiça:** gravado como a JUDIT devolve (ela já devolve
     quase tudo vazio), com `secrecyLevel` para a tela avisar. **Contatos,
     endereços e sócios** do cadastro: gravados no `juditData`, porque o
     usuário decidiu guardar tudo; a tela não os mostra por padrão. Os dois
     saem com "apagar este assunto" (`deleteSubjectRecords`), que remove o
     que só aquele assunto encontrou e mantém o que outro assunto também
     encontrou.
   - **De onde vem:** consulta síncrona (página Consultar, card de
     processos da parte, dados cadastrais ao adicionar uma parte),
     resultado assíncrono ao abrir ("Ver resultado"), resultados de
     monitoramento ("Ver resultados") e entregas de webhook (o corpo
     inteiro, que só existe na requisição: `webhook_events` continua com o
     resumo). Uma falha ao gravar na base vai para o log (`[base]`) e não
     esconde o resultado, que já foi cobrado.
   - Testes num MongoDB temporário (`src/features/base/db.test.ts`):
     gravação, mais novo substitui, mais velho não, um processo para vários
     assuntos, resumo por IA preservado, mandados e execuções, cadastros de
     uma busca por nome, e "apagar assunto".
   - _Decisões do agente:_ execução penal na coleção de processos; uma
     entrega de webhook que chega antes de a consulta ser gravada não acha
     o assunto e não grava (o resultado volta à base ao abrir a consulta);
     os registros antigos do histórico (`sync_queries`) não foram
     reprocessados.
6. **Página Minhas informações** (D2), em `src/features/subjects/`.
   - **Assunto** (`subjects.ts`): cada identificador pesquisado, monitorado
     ou salvo, montado do histórico de consultas, dos monitoramentos, das
     partes e dos alertas, sem coleção nova. "Monitorado" quer dizer algum
     monitoramento vigiando (pausado não conta).
   - **`/informacoes`**: no topo, os números (assuntos, monitoramentos
     ativos, alertas não lidos, consultas em andamento) e "O que chegou"
     (alertas não lidos, cada um levando à ficha); no meio, a lista de
     assuntos, com os que têm alerta primeiro, filtros por tipo, "Só
     monitorados" e texto.
   - **Ficha `/informacoes/[tipo]/[chave]`**: alertas (com "marcar como
     lido"), monitoramento (a tabela de sempre, com o menu de ações),
     dados cadastrais, números (contagem e resumo agrupado), processos
     (com aviso de segredo de justiça e o resumo por IA), execuções penais,
     mandados, cada um com "consultado em"; consultas feitas (as
     assíncronas com "Verificar status" e "Ver resultado"); "O que ainda
     não se sabe" (perguntas do catálogo ainda não feitas, como links para
     Consultar) e "Apagar este assunto".
   - **Apagar** (`subjects/db.ts`): recusa com monitoramento não excluído
     (cobrança recorrente) ou consulta assíncrona aberta; apaga a base
     própria do assunto (o que só ele encontrou), o histórico de consultas
     dele e a parte salva, se nenhum monitoramento aponta para ela.
   - **Rotas antigas** redirecionam pelo `next.config.ts`: `/empresas` e
     `/pessoas` para a lista filtrada, `/empresas/:cnpj`, `/pessoas/:cpf` e
     `/processos/:cnj` para a ficha, `/consultas`, `/alertas` e
     `/monitoramentos/alertas` para `/informacoes`, `/monitoramentos` para a
     lista "Só monitorados". As abas provisórias da fatia 3 saíram; os links
     internos apontam direto para os endereços novos (`partyHref` leva à
     ficha).
   - A consulta assíncrona on-demand, que só existia no card da página da
     parte, entrou no catálogo da página Consultar ("Qual é o histórico
     completo, buscado agora nos tribunais?", CPF e CNPJ).
   - Conferido com capturas de tela no modo banco. _Decisões do agente:_
     a ficha cuida do que já existe (pausar, marcar como lido, apagar); pedir
     algo novo é sempre um link para Consultar. Os componentes das páginas
     removidas saem na fatia 9.
7. **Barra de pesquisa unificada** (`search-suggestions.ts`,
   `global-search.tsx`). Em todas as páginas: primeiro os assuntos do banco
   (nome ou parte da chave; o do identificador digitado vem antes), com
   "monitorado" e "consultado em"; se o texto é um identificador, as
   consultas feitas sobre ele, com a data (levam à ficha); por último, com
   menos destaque, "Consultar …", que abre a página Consultar preenchida
   (`?valor=&tipo=`), para qualquer tipo reconhecido, inclusive OAB e nome.
   Na página Consultar, a barra não abre sugestões: o que se digita nela vai
   para o campo da página, que recebe o foco (evento
   `raio-x:consult-field`). O histórico de consultas passou a ir do layout
   para o store do navegador (`queries`), para a barra montar os assuntos.
   Testes da lógica pura; o comportamento de digitar na barra não foi
   conferido num navegador interativo.
8. **Webhook nos monitoramentos (D6).** Conferido na documentação: a
   `callback_url` vai no corpo de `POST /tracking`, no nível de cima
   (tracking-document e tracking, seção do webhook; `Tracking.Body.Post` no
   OpenAPI), então não precisa do `PATCH` depois. `createTracking` aceita
   `callbackUrl`; o envio da reserva usa `productCallbackUrl()` (a mesma das
   consultas assíncronas): com `JUDIT_WEBHOOK_PUBLIC_ORIGIN` preenchida, o
   monitoramento leva a `callback_url` e é confirmado com
   `delivery: "webhook"`; sem ela, `polling`. Webhook pela metade (origem
   sem token) devolve a reserva a pendente sem chamar a JUDIT. A mensagem
   de criação, o diálogo e a ficha dizem como os resultados chegam. A
   entrega real depende de túnel e de um teste do usuário (não feito).
9. **Limpeza e demonstração (D7).**
   - **Saíram** (sem uso depois das fatias 3 a 8): barra lateral (`ui/sidebar`,
     `use-mobile`, `avatar`), abas (`section-tabs` e as das partes e dos
     monitoramentos), Dashboard (`overview-dashboard`, `stats`,
     `column-chart`, `activity-feed`), página e lista de partes
     (`party-pages`, `party-detail`, `parties-list`, `demo-party-page`,
     `party-lawsuits-card`, `registration-status-badge`), central de alertas
     (`alerts-center`; os estilos foram para `alert-type-styles.ts`), página
     de monitoramentos, página do histórico (as células reaproveitadas pela
     ficha foram para `query-cells.tsx`), card de consultas assíncronas da
     parte, `remote-lawsuit`, `distribution-card`, as actions
     `searchPartyLawsuitsAction` e `refreshRegistrationDataAction` (com os
     testes delas) e funções de dados sem uso. A suíte foi de 372 para 356
     testes por isso.
   - **Coerência com "cada página tem uma função":** na ficha, a folha do
     processo não tem "Monitorar" (`readOnly`); "Marcar todos como lidos"
     entrou nos alertas da ficha.
   - **Demonstração:** os alertas fictícios passaram a apontar para o
     monitoramento de onde vieram (como no banco), para aparecerem na ficha e
     na contagem dos assuntos. Na página Consultar, OAB, nome e RJI mostram
     "Indisponível na demonstração" e os botões ficam desligados.
   - **Conferência:** build de demonstração (`DATA_SOURCE=demo`, porta 3124) e o servidor do usuário em modo banco: `/`, `/informacoes`, as
     fichas, `/configuracoes` e `/webhooks` respondem 200 nos dois modos; as
     rotas antigas redirecionam; capturas de tela de Minhas informações, da
     ficha e de Consultar com OAB. Não conferido: digitar na barra e clicar
     nos botões (sem navegador interativo).

## Círculo 3B (2026-10-17)

Observações do usuário, de cima para baixo, depois do círculo 3
(resumidas pelo agente):

1. **Nome da página 2.** "Minhas informações" não serve. Escolhido
   **Acervo** (o agente apontou que "Dados" confundiria com "dados
   cadastrais"). A alternância do topo fica só com ícones: a página ativa
   expande com o nome; a outra mostra só o ícone (caderno com lápis para
   Consultar, biblioteca para Acervo). _Feito:_ rota `/acervo`, e
   `/informacoes` (com a ficha) redireciona; os números "1" e "2" saíram.
2. **Barra de pesquisa como a do Google.** Uma só, igual em todas as
   páginas: primeiro o que já está no banco e contém o texto (o
   identificador já pesquisado leva à ficha), depois sempre "Fazer nova
   consulta", depois os outros resultados; sem nada, "Dado não
   encontrado". Sem autocompletar. _Em discussão:_ como buscar dentro dos
   dados guardados sem custo nem demora (ver as opções na conversa).
3. **Sem avisos de "base legal".** O cliente já conhece as regras. _Feito:_
   saíram da página Consultar, do diálogo de monitoramento e do diálogo de
   adicionar parte. O CPF continua mascarado nas listas (o usuário
   aprovou).
4. **Cores do selo de tempo.** Cinza parecia "não pode". _Feito:_ "Agora"
   (era "Na hora") em verde e "Depois" em azul; o texto de tempo e custo do
   catálogo também diz "Agora".

### Círculo 3B: implementação (2026-10-17)

- **Busca (3B.2), opção B.** Decidida na conversa depois de comparar três
  jeitos de buscar no MongoDB (Atlas Search, termos próprios com índice
  comum e `$text`): a opção B funciona em qualquer MongoDB, inclusive no
  dos testes, e o Atlas Search fica para o círculo 4, ligado por variável.
  - **Coleção `search_entries`** (`src/features/search/entries.ts`): uma
    entrada por assunto e por processo guardado, com nome, uma linha de
    contexto (situação cadastral, ou tribunal e área), quantos processos o
    assunto encontrou, os termos e a última atividade. É derivada: cada
    gravação (consulta, base própria, parte, monitoramento, apagar)
    recalcula as entradas atingidas; na conexão, com a coleção vazia, ela é
    montada com o que já existe. Um assunto sem mais nada no banco perde a
    entrada.
  - **Termos** (`terms.ts`): palavras em minúsculas e sem acento, mais as
    chaves sem máscara. A busca acha as palavras que começam com o texto
    (`/^erl/`, que usa o índice), a partir de 3 caracteres. O meio da
    palavra não é achado (limite aceito).
  - **Barra única** (`search-suggestions.ts`, `global-search.tsx`): melhor
    resultado, "Fazer nova consulta", outros resultados; "Dado não
    encontrado" sem resultado e "Busca indisponível agora" se o banco
    falhar. Uma chamada por pausa de 300 ms (`use-known-search.ts`). Saiu o
    comportamento especial da página Consultar; ela agora acompanha a URL
    (`/?valor=`).
  - **Filtro do Acervo:** com 3 caracteres ou mais, a lista vem da mesma
    busca (até 50 resultados), achando também processos e cadastros pelo
    que está dentro deles.
  - Demonstração: as mesmas regras sobre os dados fictícios, em memória
    (`hits.ts`).
- **Página Consultar personalizada (3B.5).** Com um identificador
  conhecido, as instruções se recolhem (animação só de CSS) e o nome
  aparece em cima do campo. Abaixo das ações e do resultado, "Já capturado
  deste identificador", com seções que abrem com um clique (dados
  cadastrais, números, processos, execuções, mandados, monitoramento,
  consultas feitas), cada uma com a data, e "Abrir no Acervo". Os blocos
  são os mesmos da ficha (`subject-sections.tsx`). O contexto é lido de
  novo depois de cada consulta. Saiu a frase "Já está na sua lista".
- **Conferência:** testes num MongoDB temporário (busca, atualização,
  apagar, reconstrução) e da lógica pura; build de demonstração conduzido
  por um script que digita na barra, no campo da página e no filtro do
  Acervo, com capturas de tela. No modo banco, a busca só fica completa
  depois de reiniciar o `pnpm dev` (a reconstrução roda na conexão).
- **Texto por identificador (observação do usuário).** A explicação embaixo
  das perguntas falava em "empresa" para um CPF. A consulta estava certa
  (`POST /entities` serve a CPF e CNPJ); o texto vinha de um só por
  modalidade, escrito quando o app só tinha empresas. Agora
  `purposeFor(consulta, tipo)` (`catalog.ts`) dá o texto do identificador
  reconhecido (dados cadastrais, mandados, execução penal), e os textos
  gerais de `modes.ts` ficaram neutros. Pelo mesmo motivo, "Papel da
  empresa" virou "Papel da parte" e "Ver empresa" virou "Abrir ficha".
