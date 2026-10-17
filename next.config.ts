import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // Sem o indicador do Next (a bolinha "N" no canto) no `next dev`: os erros
  // de compilação e de execução continuam aparecendo.
  devIndicators: false,
  // Endereços antigos (círculo 3): Consultar virou a página inicial. A
  // query (?valor=) passa adiante sozinha.
  async redirects() {
    return [
      { source: "/consultar", destination: "/", permanent: false },
      // As páginas de leitura viraram o Acervo e a ficha de cada
      // assunto (fatia 6).
      ...[
        ["/empresas", "/acervo?tipo=cnpj"],
        ["/pessoas", "/acervo?tipo=cpf"],
        ["/empresas/:cnpj", "/acervo/cnpj/:cnpj"],
        ["/pessoas/:cpf", "/acervo/cpf/:cpf"],
        ["/processos/:cnj", "/acervo/cnj/:cnj"],
        ["/consultas", "/acervo"],
        ["/monitoramentos", "/acervo?monitorado=1"],
        ["/monitoramentos/alertas", "/acervo"],
        ["/alertas", "/acervo"],
        // Círculo 3B: "Minhas informações" virou Acervo.
        ["/informacoes", "/acervo"],
        ["/informacoes/:tipo/:chave", "/acervo/:tipo/:chave"],
      ].map(([source, destination]) => ({
        source,
        destination,
        permanent: false,
      })),
    ];
  },
  partialPrefetching: true,
  logging: {
    incomingRequests: {
      // A URL do webhook leva o token (?token=…), e o `next dev` imprime a
      // URL inteira de cada requisição. A rota registra a própria linha, sem
      // o token (src/app/api/webhooks/judit/route.ts).
      ignore: [/\/api\/webhooks\/judit/],
    },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
