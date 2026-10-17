"use client";

import { LifeBuoyIcon, RotateCcwIcon, WebhookIcon } from "lucide-react";
import Link from "next/link";
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
import { useSupportView } from "@/features/settings/support-view";
import { useDemoStore } from "@/lib/demo-store";

// No protótipo não há integrações: nem chave da JUDIT, nem banco, nem
// webhook real. Ficam a vista de suporte e a restauração dos dados
// fictícios. O app real (branch main) mostra aqui a situação de cada
// integração.
export function SettingsPanel() {
  const { reset } = useDemoStore();

  return (
    <>
      <PageIntro description="A vista de suporte e os dados de demonstração. Este protótipo não tem integrações: tudo é fictício e fica na memória da aba." />

      <SupportViewCard />

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
