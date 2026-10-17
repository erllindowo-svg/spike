import { CircleAlertIcon, CircleCheckIcon } from "lucide-react";

import { REQUIRED_ENV, type missingRequiredEnv } from "@/lib/env";

import { BrandMark } from "./brand";

// O que aparece no lugar do app quando falta configuração (o layout decide,
// src/app/(app)/layout.tsx). Só os nomes das variáveis e se estão definidas,
// nunca os valores. Sem o banco e a chave da JUDIT o app não tem o que
// mostrar nem como consultar, então ele explica o que fazer em vez de
// quebrar na primeira leitura.

const descriptions: Record<(typeof REQUIRED_ENV)[number], string> = {
  MONGODB_URI:
    "String de conexão do MongoDB (no Atlas, o formato mongodb+srv://…). É onde ficam partes, consultas, monitoramentos, webhooks e alertas.",
  JUDIT_API_KEY:
    "Chave da API da JUDIT, usada só no servidor. Sem ela, nenhuma consulta é possível.",
};

export function SetupScreen({
  missing,
}: {
  missing: ReturnType<typeof missingRequiredEnv>;
}) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-4 py-12 md:p-6 md:py-16">
      <div className="flex items-center gap-2">
        <BrandMark />
        <span className="font-heading text-sm font-semibold tracking-tight">
          Raio-X Jurídico
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Falta configurar o app
        </h1>
        <p className="text-muted-foreground">
          O Raio-X Jurídico precisa de um banco MongoDB e de uma chave da API da
          JUDIT. As variáveis ficam no servidor, num arquivo{" "}
          <code className="font-mono text-sm">.env.local</code> na raiz do
          projeto, que não vai para o Git.
        </p>
      </div>

      <ul className="flex flex-col divide-y rounded-xl border bg-card">
        {REQUIRED_ENV.map((key) => {
          const isMissing = missing.includes(key);
          return (
            <li key={key} className="flex items-start gap-3 p-4">
              {isMissing ? (
                <CircleAlertIcon
                  className="mt-0.5 size-5 shrink-0 text-warning"
                  aria-hidden
                />
              ) : (
                <CircleCheckIcon
                  className="mt-0.5 size-5 shrink-0 text-success"
                  aria-hidden
                />
              )}
              <div className="flex min-w-0 flex-col gap-1">
                <span className="flex flex-wrap items-center gap-2">
                  <code className="font-mono text-sm font-medium">{key}</code>
                  <span className="text-xs text-muted-foreground">
                    {isMissing ? "ausente ou inválida" : "definida"}
                  </span>
                </span>
                <span className="text-sm text-muted-foreground">
                  {descriptions[key]}
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm">
        <li>
          Copie o modelo:{" "}
          <code className="font-mono">cp .env.example .env.local</code>
        </li>
        <li>
          Preencha as variáveis que faltam. O{" "}
          <code className="font-mono">.env.example</code> explica cada uma,
          inclusive as opcionais (webhook, limites de custo).
        </li>
        <li>
          Para as consultas saírem do servidor, defina também{" "}
          <code className="font-mono">JUDIT_LIVE_CALLS=enabled</code>.
        </li>
        <li>
          Reinicie o servidor (<code className="font-mono">pnpm dev</code> ou{" "}
          <code className="font-mono">pnpm start</code>) e recarregue esta
          página. Para conferir sem expor valores:{" "}
          <code className="font-mono">pnpm env:check</code>.
        </li>
      </ol>
    </main>
  );
}
