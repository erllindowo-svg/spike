"use client";

import {
  DatabaseIcon,
  KeyRoundIcon,
  RotateCcwIcon,
  WebhookIcon,
} from "lucide-react";
import { toast } from "sonner";

import { PageIntro } from "@/components/shared/page-intro";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useDemoStore } from "@/lib/demo-store";

const integrations = [
  {
    icon: KeyRoundIcon,
    title: "API da JUDIT",
    description:
      "A chave (JUDIT_API_KEY) será lida apenas no servidor. Nenhuma consulta real é feita nesta etapa.",
  },
  {
    icon: WebhookIcon,
    title: "Recebimento de webhooks",
    description:
      "Endpoint previsto em /api/webhooks/judit. A validação de origem seguirá o que a JUDIT documentar.",
  },
  {
    icon: DatabaseIcon,
    title: "Banco de dados",
    description:
      "Persistência no MongoDB pronta para empresas e monitoramentos, mas a interface ainda usa apenas dados em memória.",
  },
];

export function SettingsPanel() {
  const { reset } = useDemoStore();

  return (
    <>
      <PageIntro description="Situação das integrações e controles do modo de demonstração." />

      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Integrações</CardTitle>
          <CardDescription>
            Itens pendentes, a serem configurados na etapa de integração.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col divide-y">
            {integrations.map((item) => (
              <li
                key={item.title}
                className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <item.icon className="size-4" aria-hidden />
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-sm font-medium">{item.title}</span>
                  <span className="text-sm text-muted-foreground">
                    {item.description}
                  </span>
                </div>
                <StatusBadge tone="pending">Não configurado</StatusBadge>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Dados de demonstração</CardTitle>
          <CardDescription>
            Monitoramentos criados, alertas lidos e eventos simulados existem
            apenas na memória desta aba.
          </CardDescription>
          <CardAction>
            <Button
              variant="outline"
              onClick={() => {
                reset();
                toast.success("Dados de demonstração restaurados.");
              }}
            >
              <RotateCcwIcon data-icon="inline-start" />
              Restaurar
            </Button>
          </CardAction>
        </CardHeader>
      </Card>
    </>
  );
}
