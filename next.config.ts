import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // Endereços antigos (círculo 3): Consultar virou a página inicial. A
  // query (?valor=) passa adiante sozinha.
  async redirects() {
    return [{ source: "/consultar", destination: "/", permanent: false }];
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
