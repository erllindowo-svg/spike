"use client";

import {
  CircleCheckIcon,
  ExternalLinkIcon,
  FlaskConicalIcon,
  PlusIcon,
  RadarIcon,
  SearchIcon,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

import { DistributionChart } from "@/components/shared/distribution-chart";
import { PageIntro } from "@/components/shared/page-intro";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { QuerySearchType } from "@/db/models";
import { AddPartyDialog } from "@/features/parties/components/add-party-dialog";
import {
  detectDocument,
  DOCUMENTS,
  isValidDocument,
  normalizeDocument,
  partyHref,
} from "@/features/parties/documents";
import { isValidCnj, normalizeCnj } from "@/features/processes/cnj";
import { LawsuitSheet } from "@/features/processes/components/lawsuit-sheet";
import { LawsuitsTable } from "@/features/processes/components/lawsuits-table";
import type { Lawsuit } from "@/features/processes/types";
import { useNewTrackingDialog } from "@/features/trackings/components/new-tracking-dialog";
import { SERVER_UNREACHABLE, useDemoStore } from "@/lib/demo-store";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

import { runConsultAction, type ConsultResult } from "../actions";
import { featureInfo, featuresFor, type ConsultFeatureId } from "../catalog";
import type { ConsultPayload } from "../results";

// Consultas avulsas (círculo 2 do escopo): escolher o identificador, escolher
// a consulta no catálogo, ver a resposta aqui. Nada é salvo, exceto o
// histórico da chamada; a parte só entra na lista se a pessoa pedir.

const TYPES: { value: QuerySearchType; label: string }[] = [
  { value: "cnpj", label: "CNPJ" },
  { value: "cpf", label: "CPF" },
  { value: "cnj", label: "Processo (CNJ)" },
];

const placeholders: Record<QuerySearchType, string> = {
  cnpj: DOCUMENTS.cnpj.placeholder,
  cpf: DOCUMENTS.cpf.placeholder,
  cnj: "0000000-00.0000.0.00.0000",
};

function normalize(type: QuerySearchType, value: string): string {
  return type === "cnj" ? normalizeCnj(value) : normalizeDocument(type, value);
}

function isValid(type: QuerySearchType, value: string): boolean {
  return type === "cnj" ? isValidCnj(value) : isValidDocument(type, value);
}

function initialType(param: string | null, value: string): QuerySearchType {
  if (param === "cnpj" || param === "cpf" || param === "cnj") return param;
  if (isValidCnj(value)) return "cnj";
  return detectDocument(value)?.type ?? "cnpj";
}

export function ConsultPage() {
  const searchParams = useSearchParams();
  const { parties, dataSource } = useDemoStore();
  const { openNewTracking } = useNewTrackingDialog();
  const initialValue = searchParams.get("valor") ?? "";
  const [value, setValue] = useState(initialValue);
  const [type, setType] = useState<QuerySearchType>(() =>
    initialType(searchParams.get("tipo"), initialValue),
  );
  const [feature, setFeature] = useState<ConsultFeatureId>(
    () => featuresFor(type)[0].id,
  );
  const [result, setResult] = useState<ConsultResult | null>(null);
  const [selected, setSelected] = useState<Lawsuit | null>(null);
  const [adding, setAdding] = useState(false);
  // Só na consulta processual completa: pedir também o resumo por IA (beta).
  const [aiSummary, setAiSummary] = useState(false);
  const [running, startRun] = useTransition();

  const features = featuresFor(type);
  const valid = isValid(type, value);
  const key = normalize(type, value);
  const party =
    type === "cnj"
      ? undefined
      : parties.find((p) => p.documentType === type && p.document === key);

  function changeType(next: QuerySearchType) {
    setType(next);
    setFeature(featuresFor(next)[0].id);
    setResult(null);
  }

  function changeValue(next: string) {
    setValue(next);
    setResult(null);
    // Reconhece o tipo pelo formato quando ele fica claro.
    const detected = isValidCnj(next) ? "cnj" : detectDocument(next)?.type;
    if (detected && detected !== type) changeType(detected);
  }

  function run() {
    startRun(async () => {
      try {
        setResult(
          await runConsultAction({
            feature,
            searchType: type,
            searchKey: key,
            aiSummary: feature === "lawsuit_async" ? aiSummary : undefined,
          }),
        );
      } catch {
        setResult({ ok: false, reason: "error", message: SERVER_UNREACHABLE });
      }
    });
  }

  const info = featureInfo(feature);

  return (
    <>
      <PageIntro
        description={
          dataSource === "db"
            ? "Consultas avulsas: a resposta aparece aqui, sem salvar nada nem criar monitoramento. Cada consulta é cobrada e fica no histórico de consultas."
            : "Consultas avulsas: na demonstração, as respostas vêm dos dados fictícios."
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>O que consultar</CardTitle>
          <CardDescription>
            Uma empresa (CNPJ), uma pessoa (CPF) ou um processo (CNJ). O tipo é
            reconhecido pelo formato.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ToggleGroup
            variant="outline"
            spacing={0}
            size="sm"
            value={[type]}
            onValueChange={(next) =>
              next[0] && changeType(next[0] as QuerySearchType)
            }
            aria-label="Tipo de identificador"
            className="w-fit"
          >
            {TYPES.map((t) => (
              <ToggleGroupItem key={t.value} value={t.value}>
                {t.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <Field data-invalid={value.trim() !== "" && !valid}>
            <FieldLabel htmlFor="consult-value" className="sr-only">
              Identificador
            </FieldLabel>
            <Input
              id="consult-value"
              value={value}
              placeholder={placeholders[type]}
              onChange={(e) => changeValue(e.target.value)}
              aria-invalid={value.trim() !== "" && !valid}
              className="max-w-md font-mono"
            />
            <FieldDescription>
              {value.trim() !== "" && !valid
                ? "Confira o número: os dígitos verificadores não batem."
                : party
                  ? `Já está na sua lista: ${party.name ?? "nome não consultado"}.`
                  : type === "cpf"
                    ? "CPF é dado pessoal: consulte só com base legal."
                    : " "}
            </FieldDescription>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Consulta</CardTitle>
          <CardDescription>
            Comece pela contagem ou pelo resumo: eles mostram o tamanho antes de
            pedir a lista, que pode ser enorme.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div
            role="radiogroup"
            aria-label="Consulta"
            className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3"
          >
            {features.map((f) => {
              const fInfo = featureInfo(f.id);
              const active = f.id === feature;
              return (
                <button
                  key={f.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => {
                    setFeature(f.id);
                    setResult(null);
                  }}
                  className={cn(
                    "flex flex-col items-start gap-1.5 rounded-lg border p-3 text-left text-sm transition outline-none hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring/50",
                    active && "border-primary ring-1 ring-primary/40",
                  )}
                >
                  <span className="flex w-full items-center justify-between gap-2">
                    <span className="font-medium">{fInfo.label}</span>
                    <StatusBadge
                      tone={fInfo.flow === "sync" ? "info" : "neutral"}
                    >
                      {fInfo.flow === "sync" ? "Na hora" : "Depois"}
                    </StatusBadge>
                  </span>
                  <span className="text-muted-foreground">{fInfo.purpose}</span>
                  <span className="text-xs text-muted-foreground">
                    {fInfo.cost}
                  </span>
                </button>
              );
            })}
          </div>
          {feature === "lawsuit_async" && (
            <label className="flex w-fit items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={aiSummary}
                onChange={(e) => setAiSummary(e.target.checked)}
                className="size-4 accent-primary"
              />
              Pedir também o resumo escrito pela IA da JUDIT (beta, custo não
              informado)
            </label>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={run} disabled={!valid || running}>
              {running ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <SearchIcon data-icon="inline-start" />
              )}
              Consultar
            </Button>
            <a
              href={info.docsUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:underline"
            >
              Documentação da JUDIT
              <ExternalLinkIcon className="size-3" aria-hidden />
            </a>
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
              Resultado: {info.label.toLowerCase()}
              {result.ok && result.demo && (
                <StatusBadge tone="warning">
                  <FlaskConicalIcon className="size-3" aria-hidden />
                  Dados fictícios
                </StatusBadge>
              )}
            </CardTitle>
            {type !== "cnj" && result.ok && (
              <div className="flex flex-wrap gap-2 pt-2">
                {party ? (
                  <Button
                    variant="outline"
                    size="sm"
                    nativeButton={false}
                    render={
                      <Link
                        href={partyHref(party.documentType, party.document)}
                      />
                    }
                  >
                    Abrir página
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAdding(true)}
                  >
                    <PlusIcon data-icon="inline-start" />
                    Salvar na lista
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    openNewTracking({ searchType: type, searchKey: key })
                  }
                >
                  <RadarIcon data-icon="inline-start" />
                  Monitorar
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {result.ok ? (
              <PayloadView
                payload={result.payload}
                onSelect={setSelected}
                partyLink={type === "cnj" ? null : partyHref(type, key)}
              />
            ) : (
              <p className="text-sm text-destructive">{result.message}</p>
            )}
          </CardContent>
        </Card>
      )}

      <LawsuitSheet
        lawsuit={selected}
        onOpenChange={(open) => !open && setSelected(null)}
      />
      {type !== "cnj" && (
        <AddPartyDialog
          documentType={type}
          open={adding}
          onOpenChange={setAdding}
          defaultDocument={key}
        />
      )}
    </>
  );
}

function PayloadView({
  payload,
  onSelect,
  partyLink,
}: {
  payload: ConsultPayload;
  onSelect: (lawsuit: Lawsuit) => void;
  partyLink: string | null;
}) {
  switch (payload.kind) {
    case "count":
      return (
        <p className="flex items-baseline gap-2">
          <span className="font-heading text-4xl font-semibold tabular-nums">
            {formatNumber(payload.total)}
          </span>
          <span className="text-muted-foreground">
            {payload.total === 1 ? "processo" : "processos"} na base da JUDIT
          </span>
        </p>
      );
    case "synthetic":
      return (
        <div className="flex flex-col gap-4">
          {payload.total !== null && (
            <p className="text-sm text-muted-foreground">
              {formatNumber(payload.total)} processos no total.
            </p>
          )}
          {payload.groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum processo para agrupar.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {payload.groups.map((group) => (
                <section key={group.title} className="flex flex-col gap-2">
                  <h3 className="text-sm font-medium">{group.title}</h3>
                  <DistributionChart
                    data={group.data}
                    label={group.title.toLowerCase()}
                  />
                </section>
              ))}
            </div>
          )}
        </div>
      );
    case "lawsuits":
    case "lawsuit":
      return (
        <div className="flex flex-col gap-3">
          {payload.kind === "lawsuits" &&
            payload.total > payload.lawsuits.length && (
              <p className="text-sm text-muted-foreground">
                Mostrando {formatNumber(payload.lawsuits.length)} de{" "}
                {formatNumber(payload.total)} processos.
              </p>
            )}
          <LawsuitsTable
            lawsuits={payload.lawsuits}
            onSelect={onSelect}
            emptyDescription="A JUDIT não devolveu processos para esta consulta."
          />
        </div>
      );
    case "registration": {
      const r = payload.registration;
      if (!r.found) {
        return (
          <p className="text-sm text-muted-foreground">
            A JUDIT não encontrou cadastro para este documento.
          </p>
        );
      }
      return (
        <dl className="grid grid-cols-[10rem_1fr] gap-x-3 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Nome</dt>
          <dd>{r.name ?? "Não informado"}</dd>
          {r.tradeName && (
            <>
              <dt className="text-muted-foreground">Nome fantasia</dt>
              <dd>{r.tradeName}</dd>
            </>
          )}
          <dt className="text-muted-foreground">Situação</dt>
          <dd>{r.registrationStatus ?? "Não informada"}</dd>
          {r.specialStatus && (
            <>
              <dt className="text-muted-foreground">Situação especial</dt>
              <dd>{r.specialStatus}</dd>
            </>
          )}
        </dl>
      );
    }
    case "async":
      return (
        <div className="flex flex-col items-start gap-3 text-sm">
          <p className="flex items-center gap-2">
            <CircleCheckIcon className="size-4 text-success" aria-hidden />
            {partyLink
              ? "Consulta criada na JUDIT. O resultado chega depois: acompanhe na página da parte, que foi adicionada à sua lista."
              : "Consulta criada na JUDIT. O resultado chega depois: acompanhe no histórico de consultas."}
          </p>
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href={partyLink ?? "/consultas"} />}
          >
            Acompanhar
          </Button>
        </div>
      );
  }
}
