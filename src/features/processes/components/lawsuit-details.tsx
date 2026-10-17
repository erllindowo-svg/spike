"use client";

import { CheckCircle2Icon, RadarIcon } from "lucide-react";
import Link from "next/link";

import { CopyButton } from "@/components/shared/copy-button";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { partyHref } from "@/features/parties/documents";
import { formatCnj } from "@/features/processes/cnj";
import { partyRoleLabels, type Lawsuit } from "@/features/processes/types";
import { useNewTrackingDialog } from "@/features/trackings/components/new-tracking-dialog";
import { TrackingStatusBadge } from "@/features/trackings/components/tracking-status-badge";
import { isTrackingClosed } from "@/features/trackings/types";
import { useAppStore } from "@/lib/app-store";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  NOT_AVAILABLE,
} from "@/lib/format";

import { LawsuitStatusBadge } from "./lawsuit-status-badge";

function InfoItem({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{children ?? NOT_AVAILABLE}</dd>
    </div>
  );
}

export function LawsuitTrackingAction({ cnj }: { cnj: string }) {
  const { trackings } = useAppStore();
  const { openNewTracking } = useNewTrackingDialog();
  const tracking = trackings.find(
    (t) =>
      t.searchType === "cnj" && t.searchKey === cnj && !isTrackingClosed(t),
  );

  if (tracking) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <CheckCircle2Icon className="size-4 text-success" aria-hidden />
        <span>Processo monitorado</span>
        <TrackingStatusBadge tracking={tracking} />
      </div>
    );
  }

  return (
    <Button
      onClick={() => openNewTracking({ searchType: "cnj", searchKey: cnj })}
    >
      <RadarIcon data-icon="inline-start" />
      Monitorar este processo
    </Button>
  );
}

export function LawsuitDetails({ lawsuit }: { lawsuit: Lawsuit }) {
  const { getParty } = useAppStore();
  const company = getParty(lawsuit.partyId);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <LawsuitStatusBadge status={lawsuit.status} />
        <span className="text-xs text-muted-foreground">
          Última movimentação: {formatDateTime(lawsuit.lastMovementAt)}
        </span>
        <span className="ml-auto">
          <CopyButton
            value={formatCnj(lawsuit.cnj)}
            label="Copiar CNJ"
            successMessage="Número CNJ copiado."
          />
        </span>
      </div>

      <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
        <InfoItem label="Tribunal">{lawsuit.tribunal}</InfoItem>
        <InfoItem label="Órgão julgador">{lawsuit.judgingBody}</InfoItem>
        <InfoItem label="Área">{lawsuit.area}</InfoItem>
        <InfoItem label="Classe processual">{lawsuit.className}</InfoItem>
        <InfoItem label="Assunto">{lawsuit.subject}</InfoItem>
        <InfoItem label="Papel da parte">
          {lawsuit.partyRole ? partyRoleLabels[lawsuit.partyRole] : null}
        </InfoItem>
        <InfoItem label="Distribuição">
          {lawsuit.distributedAt ? formatDate(lawsuit.distributedAt) : null}
        </InfoItem>
        <InfoItem label="Valor da causa">
          {lawsuit.amount !== null ? formatCurrency(lawsuit.amount) : null}
        </InfoItem>
        <InfoItem
          label={
            company?.documentType === "cpf"
              ? "Pessoa relacionada"
              : "Empresa relacionada"
          }
        >
          {company ? (
            <Link
              href={partyHref(company.documentType, company.document)}
              className="text-primary underline-offset-4 hover:underline"
            >
              {company.name ?? "Nome não consultado"}
            </Link>
          ) : null}
        </InfoItem>
      </dl>

      <Separator />

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold">Movimentações</h3>
        </div>
        {lawsuit.movements.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            As movimentações dos processos da JUDIT ainda não são exibidas.
          </p>
        ) : (
          <ol className="flex flex-col">
            {lawsuit.movements.map((movement, index, list) => (
              <li
                key={movement.id}
                className="relative flex gap-3 pb-4 last:pb-0"
              >
                {index < list.length - 1 && (
                  <span
                    aria-hidden
                    className="absolute top-3 bottom-0 left-[5px] w-px bg-border"
                  />
                )}
                <span
                  aria-hidden
                  className={`relative mt-1.5 size-[11px] shrink-0 rounded-full border-2 ${index === 0 ? "border-primary bg-primary/20" : "border-border bg-background"}`}
                />
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm">{movement.description}</span>
                  <time
                    dateTime={movement.occurredAt.toISOString()}
                    className="text-xs text-muted-foreground tabular-nums"
                  >
                    {formatDateTime(movement.occurredAt)}
                  </time>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
