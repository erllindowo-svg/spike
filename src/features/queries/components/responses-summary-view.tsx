import { SparklesIcon } from "lucide-react";

import { formatCnj } from "@/features/processes/cnj";
import { LawsuitsTable } from "@/features/processes/components/lawsuits-table";
import type { Lawsuit } from "@/features/processes/types";
import { formatDate, formatNumber } from "@/lib/format";

import { SupportOnly } from "@/features/settings/support-view";

import { missingDeliveries, type DeliveryCheck } from "../deliveries";
import type { ResponsesSummary } from "../responses";

// Resultado de GET /responses (consulta assíncrona) ou de
// GET /responses/tracking (monitoramento): contagens, processos, mandados e
// o resumo por IA, quando houver.
export function ResponsesSummaryView({
  results,
  onSelectLawsuit,
  deliveryCheck = null,
}: {
  results: ResponsesSummary;
  onSelectLawsuit: (lawsuit: Lawsuit) => void;
  // Consulta com entrega por webhook: o que chegou x o que a JUDIT lista.
  deliveryCheck?: DeliveryCheck | null;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg bg-muted/40 p-3">
      {deliveryCheck && (
        <SupportOnly>
          <DeliveryCheckLine check={deliveryCheck} />
        </SupportOnly>
      )}
      <p className="text-sm text-muted-foreground">
        {formatNumber(results.totalResponses)} resposta(s) na JUDIT
        {results.loadedResponses < results.totalResponses &&
          `, ${formatNumber(results.loadedResponses)} carregada(s)`}
        {` · ${formatNumber(results.cachedResponses)} do cache`}
        {results.ignoredResponses > 0 &&
          ` · ${formatNumber(results.ignoredResponses)} em formato não reconhecido`}
        . Não fica salvo: recarregar a página limpa o resultado.
      </p>
      {results.applicationErrors.length > 0 && (
        <ul className="text-sm text-warning">
          {results.applicationErrors.map((text, index) => (
            <li key={index}>{text}</li>
          ))}
        </ul>
      )}
      {results.aiSummary && (
        <section className="flex flex-col gap-1.5 rounded-md border bg-background p-3">
          <h4 className="flex items-center gap-2 text-sm font-medium">
            <SparklesIcon className="size-4 text-primary" aria-hidden />
            Resumo escrito pela IA da JUDIT (beta)
          </h4>
          <p className="text-sm whitespace-pre-line text-muted-foreground">
            {results.aiSummary}
          </p>
        </section>
      )}
      {results.warrants.length > 0 && (
        <section className="flex flex-col gap-2">
          <h4 className="text-sm font-medium">
            {formatNumber(results.warrants.length)} mandado(s) de prisão
          </h4>
          <ul className="flex flex-col divide-y rounded-md border bg-background text-sm">
            {results.warrants.map((warrant, index) => (
              <li
                key={warrant.number ?? index}
                className="flex flex-col gap-1 p-3"
              >
                <span className="font-medium">
                  {warrant.warrantType ?? "Mandado"}
                  {warrant.status && ` · ${warrant.status}`}
                </span>
                <span className="text-xs text-muted-foreground">
                  {[
                    warrant.code && `Processo ${formatCnj(warrant.code)}`,
                    warrant.arrestType &&
                      `Prisão ${arrestTypes[warrant.arrestType] ?? warrant.arrestType}`,
                    warrant.issueDate &&
                      `Expedido em ${formatDate(new Date(warrant.issueDate))}`,
                    warrant.expirationDate &&
                      `Válido até ${formatDate(new Date(warrant.expirationDate))}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                {warrant.judgementSummary && (
                  <span className="text-xs text-muted-foreground">
                    {warrant.judgementSummary}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      {(results.lawsuits.length > 0 || results.warrants.length === 0) && (
        <LawsuitsTable
          lawsuits={results.lawsuits}
          onSelect={onSelectLawsuit}
          emptyDescription="A consulta não retornou processos."
        />
      )}
    </div>
  );
}

// Natureza da prisão, como a JUDIT escreve (schema warrant).
const arrestTypes: Record<string, string> = {
  definitive: "definitiva",
  temporary: "temporária",
  preventive: "preventiva",
};

// Conferência de entregas perdidas (IK10, deliveries.ts). A relação "uma
// resposta, uma entrega" é hipótese nossa; o texto diz isso.
function DeliveryCheckLine({ check }: { check: DeliveryCheck }) {
  const missing = missingDeliveries(check);
  const base = `Entregas por webhook: ${formatNumber(check.received)} de ${formatNumber(check.expected)} resposta(s)${check.completionNotice ? ", mais o aviso de fim (600)" : ", sem o aviso de fim (600)"}.`;
  if (missing > 0) {
    return (
      <p className="text-sm text-warning">
        {base} Faltam {formatNumber(missing)}: a JUDIT pode ter desistido de
        reenviar enquanto a rota estava fora do ar (IK10). O resultado abaixo
        veio da consulta direta, então nada se perdeu.
      </p>
    );
  }
  return (
    <p className="text-sm text-muted-foreground">
      {base}
      {check.received > check.expected &&
        " Mais entregas do que respostas: a relação entre as duas é hipótese nossa (IK10)."}
    </p>
  );
}
