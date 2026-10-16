"use client";

import { BellIcon, CloudDownloadIcon, DatabaseIcon } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import {
  runConsultAction,
  type ConsultResult,
} from "@/features/consult/actions";
import { featureInfo } from "@/features/consult/catalog";
import { SERVER_UNREACHABLE, useDemoStore } from "@/lib/demo-store";
import { formatDateTime } from "@/lib/format";

import { formatCnj } from "../cnj";
import { LawsuitDetails, LawsuitTrackingAction } from "./lawsuit-details";

// Página de um processo no modo "db" (círculo 2, fatia 8). Os processos não
// ficam guardados no app (desenho híbrido da etapa 3): a página mostra o que
// o app sabe (monitoramento, alertas) e busca a capa na JUDIT por clique,
// pela base (rápido) ou no tribunal (atualizado, até 3 minutos). Cada busca
// entra no histórico de consultas.
export function RemoteLawsuit({ cnj }: { cnj: string }) {
  const { alerts } = useDemoStore();
  const [result, setResult] = useState<ConsultResult | null>(null);
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null);
  const [running, startRun] = useTransition();
  const [runningFeature, setRunningFeature] = useState<string | null>(null);
  const lawsuitAlerts = alerts.filter((a) => a.lawsuitCnj === cnj);

  function fetchLawsuit(feature: "lawsuit_datalake" | "lawsuit_on_demand") {
    setRunningFeature(feature);
    startRun(async () => {
      try {
        setResult(
          await runConsultAction({
            feature,
            searchType: "cnj",
            searchKey: cnj,
          }),
        );
        setFetchedAt(new Date());
      } catch {
        setResult({ ok: false, reason: "error", message: SERVER_UNREACHABLE });
      }
      setRunningFeature(null);
    });
  }

  return (
    <>
      <Card className="max-w-4xl">
        <CardHeader className="flex flex-col gap-3 border-b sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Processo</span>
            <CardTitle className="font-mono text-lg">
              {formatCnj(cnj)}
            </CardTitle>
          </div>
          <LawsuitTrackingAction cnj={cnj} />
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            O app não guarda os processos: a capa vem da JUDIT quando você pede.
            Cada busca é cobrada e entra no histórico de consultas.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={running}
              onClick={() => fetchLawsuit("lawsuit_datalake")}
              title={featureInfo("lawsuit_datalake").purpose}
            >
              {runningFeature === "lawsuit_datalake" ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <DatabaseIcon data-icon="inline-start" />
              )}
              Buscar na base da JUDIT
            </Button>
            <Button
              variant="outline"
              disabled={running}
              onClick={() => fetchLawsuit("lawsuit_on_demand")}
              title={featureInfo("lawsuit_on_demand").purpose}
            >
              {runningFeature === "lawsuit_on_demand" ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <CloudDownloadIcon data-icon="inline-start" />
              )}
              Atualizar no tribunal (até 3 min)
            </Button>
          </div>

          {result &&
            (result.ok && result.payload.kind === "lawsuit" ? (
              result.payload.lawsuits.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  A JUDIT não tem este processo na base. Tente atualizar no
                  tribunal.
                </p>
              ) : (
                <div className="flex flex-col gap-6">
                  {fetchedAt && (
                    <p className="text-xs text-muted-foreground">
                      Buscado em {formatDateTime(fetchedAt)}. Recarregar a
                      página limpa a capa.
                    </p>
                  )}
                  {result.payload.lawsuits.map((lawsuit) => (
                    <LawsuitDetails key={lawsuit.id} lawsuit={lawsuit} />
                  ))}
                </div>
              )
            ) : (
              <p className="text-sm text-destructive">
                {result.ok ? "Resposta inesperada." : result.message}
              </p>
            ))}
        </CardContent>
      </Card>

      <Card className="max-w-4xl">
        <CardHeader>
          <CardTitle>Alertas deste processo</CardTitle>
          <CardDescription>
            Gerados pelos monitoramentos, guardados no app.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {lawsuitAlerts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum alerta.</p>
          ) : (
            <ul className="flex flex-col divide-y text-sm">
              {lawsuitAlerts.map((alert) => (
                <li key={alert.id} className="flex items-start gap-2 py-2">
                  <BellIcon
                    className="mt-0.5 size-4 text-muted-foreground"
                    aria-hidden
                  />
                  <span className="flex flex-col">
                    <span className="font-medium">{alert.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(alert.createdAt)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {lawsuitAlerts.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-2"
              nativeButton={false}
              render={<Link href="/monitoramentos/alertas" />}
            >
              Ver todos os alertas
            </Button>
          )}
        </CardContent>
      </Card>
    </>
  );
}
