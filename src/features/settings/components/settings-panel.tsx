"use client";

import {
  DatabaseIcon,
  KeyRoundIcon,
  LifeBuoyIcon,
  RotateCcwIcon,
  ShieldCheckIcon,
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
import type {
  IntegrationId,
  IntegrationStatus,
} from "@/features/settings/status";
import { useSupportView } from "@/features/settings/support-view";
import { useDemoStore } from "@/lib/demo-store";

const integrationInfo: Record<
  IntegrationId,
  { icon: typeof KeyRoundIcon; title: string }
> = {
  judit: { icon: KeyRoundIcon, title: "API da JUDIT" },
  cost: { icon: ShieldCheckIcon, title: "Proteção de custo" },
  webhooks: { icon: WebhookIcon, title: "Recebimento de webhooks" },
  database: { icon: DatabaseIcon, title: "Banco de dados" },
};

export function SettingsPanel({
  integrations,
}: {
  // Calculado no servidor (status.ts): só a situação, nunca os valores.
  integrations: IntegrationStatus[];
}) {
  const { reset, dataSource } = useDemoStore();

  return (
    <>
      <PageIntro description="Situação das integrações, lida das variáveis de ambiente do servidor, e a vista de suporte." />

      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Integrações</CardTitle>
          <CardDescription>
            Mostra se cada variável está definida, nunca o valor. Definida não
            quer dizer funcionando: a chave e o banco só são testados quando
            usados.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col divide-y">
            {integrations.map((item) => {
              const info = integrationInfo[item.id];
              return (
                <li
                  key={item.id}
                  className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <info.icon className="size-4" aria-hidden />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-sm font-medium">{info.title}</span>
                    <span className="text-sm text-muted-foreground">
                      {item.description}
                    </span>
                  </div>
                  <StatusBadge tone={item.tone}>{item.label}</StatusBadge>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      <SupportViewCard />

      {dataSource === "demo" && (
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
      )}
    </>
  );
}

function SupportViewCard() {
  const [enabled, setEnabled] = useSupportView();

  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Vista de suporte
          <StatusBadge tone={enabled ? "info" : "neutral"}>
            {enabled ? "Ligada" : "Desligada"}
          </StatusBadge>
        </CardTitle>
        <CardDescription>
          Mostra o que só interessa a quem dá suporte: identificadores técnicos
          (request_id, callback_id), o canal de entrega das consultas e o
          Diagnóstico de webhooks no menu. Fica salva neste navegador. Não é uma
          proteção: quem tem o endereço abre qualquer página.
        </CardDescription>
        <CardAction>
          <Button
            variant="outline"
            aria-pressed={enabled}
            onClick={() => setEnabled(!enabled)}
          >
            <LifeBuoyIcon data-icon="inline-start" />
            {enabled ? "Desligar" : "Ligar"}
          </Button>
        </CardAction>
      </CardHeader>
    </Card>
  );
}
