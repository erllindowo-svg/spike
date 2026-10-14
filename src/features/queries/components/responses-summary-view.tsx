import { LawsuitsTable } from "@/features/processes/components/lawsuits-table";
import type { Lawsuit } from "@/features/processes/types";
import { formatNumber } from "@/lib/format";

import type { ResponsesSummary } from "../responses";

// Resultado de GET /responses (consulta assíncrona) ou de
// GET /responses/tracking (monitoramento): contagens e processos.
export function ResponsesSummaryView({
  results,
  onSelectLawsuit,
}: {
  results: ResponsesSummary;
  onSelectLawsuit: (lawsuit: Lawsuit) => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg bg-muted/40 p-3">
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
      <LawsuitsTable
        lawsuits={results.lawsuits}
        onSelect={onSelectLawsuit}
        emptyDescription="A consulta não retornou processos."
      />
    </div>
  );
}
