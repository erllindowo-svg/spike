# Integração JUDIT

Cliente HTTP e funções de chamada aos serviços da JUDIT (somente servidor).

Ainda não implementado. Endpoints, autenticação e formatos de payload devem
ser implementados a partir da documentação oficial (<https://docs.judit.io>),
cobrindo:

- Dados cadastrais de empresas.
- Consultas processuais e consultas sintéticas.
- Criação e acompanhamento de monitoramentos (tracking).
- Consulta das respostas associadas às requisições.

Regras:

- Todo módulo desta pasta deve começar com `import "server-only"`.
- A chave é lida via `getServerEnv("JUDIT_API_KEY")` (`src/lib/env.ts`) e
  nunca deve ser registrada em logs, retornada ao cliente ou exposta em
  variáveis `NEXT_PUBLIC_*`.
