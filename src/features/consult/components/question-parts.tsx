"use client";

import { ExternalLinkIcon, RadarIcon, SearchIcon } from "lucide-react";

import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { SearchType } from "@/db/models";
import { isDocumentType } from "@/features/parties/documents";
import { lowerFirst } from "@/lib/format";
import { cn } from "@/lib/utils";

import {
  featureInfo,
  purposeFor,
  trackingFor,
  type ConsultFeature,
  type ConsultFeatureId,
} from "../catalog";

// As peças de uma pergunta, comuns à página Consultar e à ficha do Acervo
// (círculo 5): o cartão da pergunta e o bloco com a explicação, os botões e
// o custo. Mesmas regras nas duas páginas.

// Os dados fictícios só têm empresas, pessoas e processos (D7).
export function demoUnavailable(
  dataSource: "demo" | "db",
  type: SearchType,
): boolean {
  return dataSource !== "db" && type !== "cnj" && !isDocumentType(type);
}

// Uma pergunta, como opção de um grupo (role="radio"). Entra deslizando,
// depois das anteriores (`index`).
export function QuestionOption({
  feature,
  searchType,
  active,
  index,
  onSelect,
}: {
  feature: ConsultFeature;
  searchType: SearchType;
  active: boolean;
  index: number;
  onSelect: () => void;
}) {
  const info = featureInfo(feature.id);
  const monitorable = !!trackingFor(feature.id, searchType);
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onSelect}
      style={{ animationDelay: `${150 + index * 60}ms` }}
      className={cn(
        "flex animate-in flex-col items-start gap-1.5 rounded-lg border p-3 text-left text-sm transition fill-mode-backwards outline-none fade-in slide-in-from-bottom-3 hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring/50 motion-reduce:animate-none",
        active && "border-primary ring-1 ring-primary/40",
      )}
    >
      <span className="font-medium">{feature.question}</span>
      <span className="text-xs text-muted-foreground">{info.label}</span>
      <span className="flex flex-wrap items-center gap-1.5 pt-1">
        {/* Verde e azul: as duas existem; cinza pareceria desabilitado
            (círculo 4). */}
        <StatusBadge tone={info.flow === "sync" ? "success" : "info"}>
          {info.flow === "sync" ? "Agora" : "Depois"}
        </StatusBadge>
        {monitorable && (
          <StatusBadge tone="neutral">
            <RadarIcon className="size-3" aria-hidden />
            Monitorável
          </StatusBadge>
        )}
      </span>
      <span className="text-xs text-muted-foreground">{feature.timing}</span>
    </button>
  );
}

// O que vem depois de escolher a pergunta: para que serve, o resumo por IA
// (só na consulta processual completa), Consultar e, onde existe,
// Monitorar, e o custo de cada um.
export function QuestionActions({
  featureId,
  searchType,
  aiSummary,
  onAiSummaryChange,
  running,
  unavailable,
  onRun,
  onMonitor,
}: {
  featureId: ConsultFeatureId;
  searchType: SearchType;
  aiSummary: boolean;
  onAiSummaryChange: (value: boolean) => void;
  running: boolean;
  unavailable: boolean;
  onRun: () => void;
  onMonitor: () => void;
}) {
  const tracking = trackingFor(featureId, searchType);
  return (
    <>
      <p className="max-w-3xl text-sm text-muted-foreground">
        {purposeFor(featureId, searchType)}
      </p>

      {featureId === "lawsuit_async" && (
        <label className="flex w-fit items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={aiSummary}
            onChange={(e) => onAiSummaryChange(e.target.checked)}
            className="size-4 accent-primary"
          />
          Pedir também o resumo escrito pela IA da JUDIT (beta, custo não
          informado)
        </label>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={onRun} disabled={running || unavailable}>
          {running ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <SearchIcon data-icon="inline-start" />
          )}
          Consultar
        </Button>
        {tracking && (
          <Button variant="outline" onClick={onMonitor} disabled={unavailable}>
            <RadarIcon data-icon="inline-start" />
            Monitorar
          </Button>
        )}
        <a
          href={featureInfo(featureId).docsUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:underline"
        >
          Documentação da JUDIT
          <ExternalLinkIcon className="size-3" aria-hidden />
        </a>
      </div>
      {unavailable && (
        <p className="text-sm text-warning">
          Indisponível na demonstração: os dados fictícios só têm empresas,
          pessoas e processos.
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        {tracking
          ? `Consultar: uma resposta agora, cobrada uma vez. Monitorar (${lowerFirst(tracking.label)}): ${lowerFirst(tracking.follows)} Cobrado a cada execução, até ser pausado.`
          : "Consultar: uma resposta agora, cobrada uma vez. Esta pergunta não tem monitoramento na JUDIT."}
      </p>
    </>
  );
}
