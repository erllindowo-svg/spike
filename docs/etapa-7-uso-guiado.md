# Etapa 7: uso guiado

Primeiro passo da etapa 7 (`docs/plano-etapas-6-7.md`, "Etapa 7
redefinida"). Você usa o app como cliente, com objetivos e não com
instruções de clique, e anota onde trava. As anotações viram o fluxo
desejado (passo 2) e a lista de fatias.

## Como fazer

- Durante a tarefa, não abra o código, o terminal nem o Atlas. Se precisou
  deles, isso já é uma anotação.
- "Travar" é qualquer hesitação: procurar algo que não estava lá, ler um
  texto sem entender, ter que lembrar de como o código funciona.
- Cerca de 5 minutos por tarefa. Travou por mais de 2, anote e siga.
- Pode anotar aqui ou ditar no chat; o agente registra o que você ditar na
  seção "Anotações", marcado como ditado.

**O que chama a JUDIT (só com o CNPJ de teste `A1B2C3D4/E5F6-68`):**
"Fazer consulta síncrona" e a consulta assíncrona são cobradas por
requisição; "Atualizar status" e "Ver resultados" consultam por ID. **Não
clique em "Reativar"** no monitoramento do CNPJ de teste: a recorrência é
cobrada e ele nunca dispara (catálogo, C14). Outros CNPJs são barrados pela
allowlist antes de sair do servidor.

## Rodada 1: app real (modo `db`, o `pnpm dev` atual)

1. **Risco.** "Vou fechar negócio com a empresa `A1B2C3D4/E5F6-68`. Ela tem
   risco jurídico?" Responda sim ou não, com a justificativa que a tela der.
2. **Vigilância.** "Essa empresa já está sendo vigiada? Desde quando? A
   última verificação achou algo?"
3. **Empresa nova.** "Quero acompanhar também a empresa
   `11.222.333/0001-81`." (Número de exemplo; a allowlist impede que ele saia
   do servidor. Se sobrar um registro no banco, anote como ele ficou.)
4. **Bom dia.** "Abri o app de manhã: chegou algo novo que eu precise ver?"
5. **Suporte.** "Um cliente diz: pedi uma consulta assíncrona e nunca recebi
   o resultado." Descubra, só pelas telas, se a consulta terminou, se a
   JUDIT avisou e se o aviso foi processado.

## Rodada 2: protótipo (modo `demo`)

Troque `DATA_SOURCE` para `"demo"` no `.env.local`, reinicie o `pnpm dev`
(catálogo, D6) e confira com `pnpm env:check`. No fim, volte para `"db"`.

6. Repita as tarefas 1, 2 e 4 com uma empresa da lista.
7. **Carteira.** "O que mudou nas minhas empresas desde a semana passada?"
8. **Alerta.** "Chegou um alerta de processo novo: o que ele significa e o
   que eu faço com ele?"

## Anotações

### 2026-10-15 (ditado)

> Esta versão está funcionando com a minha chave da API. Se eu digitar um
> CNPJ, o app vai encontrar?
>
> Proposta: ter um ícone de informação, um "i", que explique de forma bem
> resumida todas as possibilidades do dashboard (monitoramento, consulta
> assíncrona e as outras funções), porque hoje não está muito intuitivo.

Palavra não entendida na transcrição: "bem chapelhado" (no fim da frase
sobre o resumo). Corrija aqui se quiser.

**Resposta do agente à pergunta:** não. A busca do topo
(`src/components/layout/global-search.tsx:37-50`) só procura no banco; um
CNPJ desconhecido mostra "não encontrado no banco de dados", com um texto
antigo ("será habilitada na etapa de integração") e o botão "Monitorar".
Uma empresa só entra no banco ao criar um monitoramento
(`ensureCompany`, chamado em `src/features/trackings/db.ts:112`). E, mesmo
com uma busca ligada à JUDIT, um CNPJ real seria barrado pela allowlist
(`src/lib/judit/guard.ts:38`), que só tem o CNPJ de teste. Candidato a
fatia: "buscar CNPJ" consultar a JUDIT e cadastrar a empresa, sem exigir um
monitoramento. Para CNPJs reais, a decisão de liberar a allowlist é sua.

> Na tela de Configurações aparece que nada está configurado: a chave da
> API, o recebimento de webhooks e o banco de dados. Como é que não está
> nada configurado?

**Resposta do agente:** a tela não lê o ambiente. O selo "Não configurado"
e os textos são fixos desde o protótipo da etapa 1
(`src/features/settings/components/settings-panel.tsx:24-43` e `:75`). O
`pnpm env:check` de hoje mostra as três coisas definidas e o app está, de
fato, lendo o Atlas e chamando a JUDIT. Candidato a fatia: o servidor
calcula a situação de cada variável (definida ou não, nunca o valor) e a
tela mostra isso. É a mesma tela "o que falta configurar" prevista para o
fechamento da etapa 7.

> Razão social é o nome da empresa? Então eu posso digitar "Pãozinho de
> Jesus" e o app vai achar? Seria legal.

**Resposta do agente:** razão social é o nome registrado da empresa (na
Receita e na Junta Comercial). O nome da fachada, como "Pãozinho de Jesus",
costuma ser o nome fantasia, que é outro campo. Hoje o app não acharia: a
busca por nome só filtra as empresas que já estão na lista
(`src/features/companies/components/companies-list.tsx:62`), e no modo `db`
a razão social fica vazia, porque ninguém chama `POST /entities` (pendência
do relatório). A JUDIT aceita `search_type: "name"` nas consultas
síncronas, assíncronas e de dados cadastrais, com um aviso de homônimos
("prefira CPF ou CNPJ"):
<https://docs.judit.io/requests/request-document#exemplos-de-consultas-históricas>,
<https://docs.judit.io/registration-data/registration-data#exemplos-por-tipo-de-documento>.
A busca por nome encontra processos em que o nome aparece; não está
documentado que ela devolva o CNPJ da empresa (hipótese a testar). A
allowlist tem `name: []` (`src/lib/judit/guard.ts:41`), então hoje toda busca
por nome é barrada. Candidato a fatia, com uma decisão sua sobre quais nomes
liberar.

> Também faltam muitas opções. Só há umas quatro no menu do canto da tela,
> e o produto está completo.

**Resposta do agente:** o menu tem Visão geral, Empresas, Monitoramentos e
Alertas, mais Diagnóstico de webhooks e Configurações
(`src/components/layout/navigation.ts`). A JUDIT documenta bem mais do que
isso, e nada disso tem tela: dados cadastrais (`/entities`), mandados de
prisão, execução criminal, monitoramento do Diário Oficial (DJEN), contagem
de processos e anexos. Escolher quais entram é uma decisão de produto do
passo 2. Dúvida de transcrição: "o produto está completo" se refere à API
da JUDIT ou, com ironia, ao nosso app?

### 2026-10-15 (ditado, com o modelo Haiku)

> Registre tudo o que eu falar nesta mensagem, como texto ditado. Depois, com os tokens de volta, esta conversa inteira vai ser lida por um modelo com todo o esforço possível.
>
> 1. O menu lateral: a opção "Visão geral" deve se chamar "Dashboard", porque a pessoa que usa tem interesse em dashboard. E o menu inteiro deveria poder ser recolhido, mostrando só os ícones. Se a lista de opções precisar existir, deveria ficar lá embaixo, pequena, perto de "Configurações".
> 2. Eu não entendo por que o app que estou rodando é a versão de demonstração. Deveria ser a versão com a API funcionando 100%.
> 3. Há informações na tela que um advogado não vai querer ver. Precisamos lembrar que isto é um produto para cliente. Proposta: em "Configurações", uma opção "Modo desenvolvedor". Exemplo: na tela de diagnóstico de webhooks aparecem callback ID, event type e reference ID, que só um desenvolvedor usaria. Um advogado não tem motivo para ver isso.
> 4. Falta um dashboard geral, que mostre tudo: empresas, pessoas físicas, e um monitoramento que unifique empresas e pessoas físicas. Pergunta minha: existe monitoramento de pessoa física? Acho que existe, porque toda atualização é feita com o documento.
> 5. Como produto, a API não é a mesma coisa que o usuário. Um escritório de advocacia inteiro usaria o mesmo produto, com vários perfis diferentes. Proposta: uma tela de login, ou, no mínimo, algo no canto onde hoje aparece "usuário de demonstração", que permita personalizar o app. Assim eu poderia disponibilizar o produto para outras pessoas.

**Observações do agente (não respondidas, só registradas):**

- Ponto 2: `pnpm env:check` mostra `DATA_SOURCE="db"`, mas a tela aparece como demonstração. Hipótese do catálogo, caso A2: o `pnpm dev` pode ter sido iniciado antes da mudança do `.env.local`. Teste: reiniciar o servidor e conferir o selo no cabeçalho (`app-header.tsx:66-84`).
- Ponto 4: o monitoramento por documento de pessoa física da JUDIT já aparece nas notas de `docs/relatorio-de-progresso.md` como caminho possível, mas nunca foi testado. Não há tela nem regra para pessoa física no app.
- Ponto 5: hoje não há usuário, sessão nem perfil no código. Login e perfis são decisões grandes, de arquitetura e de segurança (`AGENTS.md`, seção 2). Vão para a conversa de produto, não para uma fatia pequena.

### 2026-10-15: causa comum (agente, confirmada na conversa)

A hipótese de que o servidor estava em modo demo (ponto 2 acima) foi
descartada: o selo do cabeçalho é calculado (`dataSource`) e diz "Banco de
dados". O que parece demonstração são **textos fixos do protótipo da etapa
1**, que nunca dependeram do estado real. As etapas 2 a 6 ligaram os dados,
mas os textos que descrevem a situação ficaram para trás.

Textos que aparecem no modo `db` (busca por "demonstração", "não
configurado", "etapa de integração" em `src/`):

| Onde                            | Texto                                                                         | Problema                                                                        |
| ------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `app-header.tsx:70-72`          | dica do selo "Banco de dados"                                                 | Falso: diz que alertas e webhooks não são persistidos e que nada chama a JUDIT. |
| `app-header.tsx:114-128`        | "Usuário de demonstração", "Sair (indisponível)"                              | Verdadeiro (não há login), mas com cara de protótipo. Ligado ao ponto 5.        |
| `settings-panel.tsx:24-56,75`   | "Não configurado", "etapa de integração", "controles do modo de demonstração" | Falso e fixo. Já anotado acima.                                                 |
| `global-search.tsx:44`          | "será habilitada na etapa de integração"                                      | Desatualizado.                                                                  |
| `companies-list.tsx:109`        | "não está nos dados de demonstração"                                          | Depende de `canTrackQuery`, não do modo.                                        |
| `not-found.tsx:12`              | "não existe nos dados de demonstração"                                        | Fixo.                                                                           |
| `overview-dashboard.tsx:61,114` | "Panorama dos dados de demonstração"                                          | Fixo.                                                                           |
| `lawsuit-details.tsx:124`       | "Exemplos fictícios" sobre as movimentações                                   | O mais grave: rotula como fictício um dado que, no modo `db`, veio da JUDIT.    |

Não conferido: o padrão de `lawsuits-table.tsx:44` ("nos dados de
demonstração") quando nenhuma tela passa outro texto, e o cartão "Dados de
demonstração" de Configurações (`settings-panel.tsx:85`) no modo `db`.

Regra que sai daqui: um texto que descreve a situação do sistema deve ser
calculado a partir dela, como o selo do cabeçalho, e não escrito à mão. No
fim da etapa 7 os dois produtos se separam; até lá, os textos **falsos** no
modo `db` são candidatos a fatia, porque atrapalham o próprio uso guiado.

### 2026-10-15 (ditado)

> Os alertas precisam ficar dentro de Monitoramentos, porque são filhos dos
> eventos dos monitoramentos.
>
> Também precisamos criar no back-end um evento que não é usado, para
> ilustrar o envio de uma notificação desse evento para fora: como o macho
> de uma tomada, sem necessariamente ter uma fêmea, nem como objeto nem como
> objetivo.

**Observação do agente:** o código confirma a premissa do primeiro ponto.
Só eventos de monitoramento geram alerta; um evento de consulta
(`reference_type "request"`) nunca gera (`src/features/webhooks/process.ts:41-51`).

### 2026-10-15 (ditado)

> Sobre o Diagnóstico de webhooks: precisamos entender onde encaixamos as
> consultas que chegam por webhook e as normais.
>
> Fim das observações, por enquanto.

Os pontos foram reunidos e viraram escolhas em `docs/etapa-7-escopo.md`,
círculo 1.

**Correção do agente (2026-10-15):** na tabela de textos fixos acima,
"Exemplos fictícios" não rotula dados reais. No modo `db`, a seção de
movimentações fica sempre vazia, porque as movimentações (`steps`) não são
convertidas (`src/features/processes/judit.ts:37-38`). O rótulo era falso,
mas sobre uma lista vazia. Corrigido na fatia C1-13.
