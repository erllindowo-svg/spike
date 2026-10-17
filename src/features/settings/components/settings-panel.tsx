"use client";

import {
  DatabaseIcon,
  KeyRoundIcon,
  LifeBuoyIcon,
  RotateCcwIcon,
  ShieldCheckIcon,
  WalletIcon,
  WebhookIcon,
} from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { supportNav } from "@/components/layout/navigation";
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
import { Spinner } from "@/components/ui/spinner";
import {
  readJuditAccountAction,
  type AccountResult,
} from "@/features/settings/account-actions";
import type {
  IntegrationId,
  IntegrationStatus,
} from "@/features/settings/status";
import { useSupportView } from "@/features/settings/support-view";
import { AccountReading } from "./account-reading";
import { SERVER_UNREACHABLE, useDemoStore } from "@/lib/demo-store";

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

      <JuditAccountCard />

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
          Diagnóstico de webhooks, aqui embaixo. Fica salva neste navegador. Não
          é uma proteção: quem tem o endereço abre qualquer página.
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
      {enabled && <DiagnosticsLink />}
    </Card>
  );
}

// O Diagnóstico de webhooks mora aqui desde que a barra lateral saiu
// (círculo 3, fatia 3), com o número de entregas pendentes ou com falha.
function DiagnosticsLink() {
  const { webhookEvents } = useDemoStore();
  const pending = webhookEvents.filter(
    (e) => e.processingStatus === "failed" || e.processingStatus === "pending",
  ).length;

  return (
    <CardContent>
      <Button
        variant="outline"
        nativeButton={false}
        render={<Link href={supportNav.href} />}
      >
        <WebhookIcon data-icon="inline-start" />
        {supportNav.title}
        {pending > 0 && (
          <StatusBadge tone="warning">{pending} a conferir</StatusBadge>
        )}
      </Button>
    </CardContent>
  );
}

// Saldo e consumo da conta na JUDIT, por clique (F27 e F28 do mapa).
function JuditAccountCard() {
  const { dataSource } = useDemoStore();
  const [result, setResult] = useState<AccountResult | null>(null);
  const [loading, startLoading] = useTransition();

  if (dataSource !== "db") return null;

  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle>Conta na JUDIT</CardTitle>
        <CardDescription>
          Saldo de créditos (contas pré-pagas) e consumo do ciclo de
          faturamento, lidos na JUDIT só quando você pede. O consumo exige uma
          chave administrativa.
        </CardDescription>
        <CardAction>
          <Button
            variant="outline"
            disabled={loading}
            onClick={() =>
              startLoading(async () => {
                try {
                  setResult(await readJuditAccountAction());
                } catch {
                  setResult({ ok: false, message: SERVER_UNREACHABLE });
                }
              })
            }
          >
            {loading ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <WalletIcon data-icon="inline-start" />
            )}
            Consultar saldo e consumo
          </Button>
        </CardAction>
      </CardHeader>
      {result && (
        <CardContent className="flex flex-col gap-4 text-sm">
          {!result.ok ? (
            <p className="text-destructive">{result.message}</p>
          ) : (
            <AccountReading result={result} />
          )}
        </CardContent>
      )}
    </Card>
  );
}
