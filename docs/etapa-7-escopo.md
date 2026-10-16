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
