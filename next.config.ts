import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
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
