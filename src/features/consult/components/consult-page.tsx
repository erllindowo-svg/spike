"use client";

import {
  CircleCheckIcon,
  ExternalLinkIcon,
  FlaskConicalIcon,
  PlusIcon,
  RadarIcon,
  ScanSearchIcon,
  SearchIcon,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { CONSULT_FIELD_EVENT } from "@/components/layout/global-search";
import { DistributionChart } from "@/components/shared/distribution-chart";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import type { TrackingSearchType } from "@/db/models";
import { AddPartyDialog } from "@/features/parties/components/add-party-dialog";
import { isDocumentType, partyHref } from "@/features/parties/documents";
import { LawsuitSheet } from "@/features/processes/components/lawsuit-sheet";
import { LawsuitsTable } from "@/features/processes/components/lawsuits-table";
import type { Lawsuit } from "@/features/processes/types";
import { useNewTrackingDialog } from "@/features/trackings/components/new-tracking-dialog";
import { SERVER_UNREACHABLE, useDemoStore } from "@/lib/demo-store";
import { formatNumber, lowerFirst } from "@/lib/format";
import { cn } from "@/lib/utils";

import { runConsultAction, type ConsultResult } from "../actions";
import {
  featureInfo,
  featuresFor,
  trackingFor,
  type ConsultFeatureId,
} from "../catalog";
import {
  formatSearchKey,
  identify,
  SEARCH_TYPES,
  type Candidate,
  type SearchType,
} from "../identify";
import type { ConsultPayload } from "../results";
import { subjectHref } from "@/features/subjects/subjects";

// Página Consultar, a inicial (círculo 3, fatia 4): só um campo. O tipo do
// identificador é reconhecido pela digitação (identify.ts); reconhecido,
// aparecem as perguntas que a JUDIT responde para ele (catalog.ts), com
// "Consultar" (uma resposta, cobrada uma vez) e, onde existe, "Monitorar"
// (acompanhamento cobrado a cada execução). Nada é salvo além do histórico
// da chamada; a parte só entra na lista se a pessoa pedir.

const TYPE_HINT =
  "CPF, CNPJ, número de processo (CNJ), OAB com UF, nome ou RJI (mandados).";

export function ConsultPage() {
  const searchParams = useSearchParams();
  const { parties, dataSource } = useDemoStore();
  const { openNewTracking } = useNewTrackingDialog();
  const [value, setValue] = useState(searchParams.get("valor") ?? "");
  // Escolha feita em "não é isso?" (ou na URL, ?tipo=). Vale só enquanto o
  // tipo estiver entre os candidatos.
  const [chosenType, setChosenType] = useState<SearchType | null>(
    () => (searchParams.get("tipo") as SearchType | null) ?? null,
  );
  const [featureId, setFeatureId] = useState<ConsultFeatureId | null>(null);
  const [result, setResult] = useState<ConsultResult | null>(null);
  const [selected, setSelected] = useState<Lawsuit | null>(null);
  const [adding, setAdding] = useState(false);
  // Só na consulta processual completa: pedir também o resumo por IA (beta).
  const [aiSummary, setAiSummary] = useState(false);
  const [running, startRun] = useTransition();

  const identification = identify(value);
  const candidates =
    identification.status === "recognized" ? identification.candidates : [];
  const target: Candidate | null =
    candidates.find((c) => c.type === chosenType) ?? candidates[0] ?? null;
  const features = target ? featuresFor(target.type) : [];
  const feature =
    features.find((f) => f.id === featureId) ?? features[0] ?? null;
  const tracking =
    target && feature ? trackingFor(feature.id, target.type) : null;
  const party =
    target && isDocumentType(target.type)
      ? parties.find(
          (p) => p.documentType === target.type && p.document === target.key,
        )
      : undefined;

  // Na página Consultar, o que se digita na barra do topo vem para cá
  // (global-search.tsx).
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    function onBarInput(event: Event) {
      setValue((event as CustomEvent<string>).detail);
      setResult(null);
      inputRef.current?.focus();
    }
    window.addEventListener(CONSULT_FIELD_EVENT, onBarInput);
    return () => window.removeEventListener(CONSULT_FIELD_EVENT, onBarInput);
  }, []);

  function changeValue(next: string) {
    setValue(next);
    setResult(null);
  }

  function run() {
    if (!target || !feature) return;
    const input = {
      feature: feature.id,
      searchType: target.type,
      searchKey: target.key,
      aiSummary: feature.id === "lawsuit_async" ? aiSummary : undefined,
    };
    startRun(async () => {
      try {
        setResult(await runConsultAction(input));
      } catch {
        setResult({ ok: false, reason: "error", message: SERVER_UNREACHABLE });
      }
    });
  }

  function monitor(alsoConsult: boolean) {
    if (!target || !feature) return;
    openNewTracking({
      searchType: target.type as TrackingSearchType,
      searchKey: target.key,
      locked: true,
      alsoConsult: alsoConsult
        ? { question: lowerFirst(feature.question), run }
        : undefined,
    });
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">O que você quer consultar?</CardTitle>
          <CardDescription>{TYPE_HINT}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="relative max-w-2xl">
            <ScanSearchIcon
              className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              ref={inputRef}
              id="consult-value"
              autoFocus
              value={value}
              placeholder="Digite o identificador"
              onChange={(e) => changeValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && target && !running) run();
              }}
              aria-label="Identificador"
              aria-invalid={identification.status === "invalid"}
              aria-describedby="consult-status"
              className="h-12 pl-10 font-mono text-base md:text-lg"
            />
          </div>
          <div id="consult-status" aria-live="polite" className="min-h-6">
            <RecognitionStatus
              identification={identification}
              target={target}
              onChoose={(type) => {
                setChosenType(type);
                setResult(null);
              }}
              partyName={party ? (party.name ?? "nome não consultado") : null}
            />
          </div>
        </CardContent>
      </Card>

      {target && feature && (
        <Card>
          <CardHeader>
            <CardTitle>O que você quer saber?</CardTitle>
            <CardDescription>
              {features.some((f) => f.id === "count")
                ? "Comece pela contagem ou pelo resumo: eles mostram o tamanho antes de pedir a lista, que pode ser enorme."
                : "Escolha uma pergunta; o tempo e o custo estão em cada uma."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div
              role="radiogroup"
              aria-label="O que você quer saber"
              className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3"
            >
              {features.map((f) => {
                const info = featureInfo(f.id);
                const active = f.id === feature.id;
                const monitorable = !!trackingFor(f.id, target.type);
                return (
                  <button
                    key={f.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => {
                      setFeatureId(f.id);
                      setResult(null);
                    }}
                    className={cn(
                      "flex flex-col items-start gap-1.5 rounded-lg border p-3 text-left text-sm transition outline-none hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring/50",
                      active && "border-primary ring-1 ring-primary/40",
                    )}
                  >
                    <span className="font-medium">{f.question}</span>
                    <span className="text-xs text-muted-foreground">
                      {info.label}
                    </span>
                    <span className="flex flex-wrap items-center gap-1.5 pt-1">
                      <StatusBadge
                        tone={info.flow === "sync" ? "info" : "neutral"}
                      >
                        {info.flow === "sync" ? "Na hora" : "Depois"}
                      </StatusBadge>
                      {monitorable && (
                        <StatusBadge tone="neutral">
                          <RadarIcon className="size-3" aria-hidden />
                          Monitorável
                        </StatusBadge>
                      )}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {f.timing}
                    </span>
                  </button>
                );
              })}
            </div>

            <p className="max-w-3xl text-sm text-muted-foreground">
              {featureInfo(feature.id).purpose}
            </p>

            {feature.id === "lawsuit_async" && (
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
              <Button onClick={run} disabled={running}>
                {running ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <SearchIcon data-icon="inline-start" />
                )}
                Consultar
              </Button>
              {tracking && (
                <Button variant="outline" onClick={() => monitor(true)}>
                  <RadarIcon data-icon="inline-start" />
                  Monitorar
                </Button>
              )}
              <a
                href={featureInfo(feature.id).docsUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:underline"
              >
                Documentação da JUDIT
                <ExternalLinkIcon className="size-3" aria-hidden />
              </a>
            </div>
            <p className="text-xs text-muted-foreground">
              {tracking
                ? `Consultar: uma resposta agora, cobrada uma vez. Monitorar (${lowerFirst(tracking.label)}): ${lowerFirst(tracking.follows)} Cobrado a cada execução, até ser pausado.`
                : "Consultar: uma resposta agora, cobrada uma vez. Esta pergunta não tem monitoramento na JUDIT."}
            </p>
          </CardContent>
        </Card>
      )}

      {result && target && feature && (
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
              {feature.question}
              {result.ok && result.demo && (
                <StatusBadge tone="warning">
                  <FlaskConicalIcon className="size-3" aria-hidden />
                  Dados fictícios
                </StatusBadge>
              )}
            </CardTitle>
            <CardDescription>
              {SEARCH_TYPES[target.type].label}{" "}
              {formatSearchKey(target.type, target.key)}
            </CardDescription>
            {result.ok && (
              <div className="flex flex-wrap gap-2 pt-2">
                {isDocumentType(target.type) &&
                  (party ? (
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
                  ))}
                {tracking && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => monitor(false)}
                  >
                    <RadarIcon data-icon="inline-start" />
                    Monitorar
                  </Button>
                )}
              </div>
            )}
          </CardHeader>
          <CardContent>
            {result.ok ? (
              <PayloadView
                payload={result.payload}
                onSelect={setSelected}
                subjectLink={subjectHref(target.type, target.key)}
              />
            ) : (
              <p className="text-sm text-destructive">{result.message}</p>
            )}
          </CardContent>
        </Card>
      )}

      {dataSource !== "db" && (
        <p className="text-xs text-muted-foreground">
          Demonstração: as respostas vêm dos dados fictícios, e as consultas
          assíncronas e por OAB, nome ou RJI não existem.
        </p>
      )}

      <LawsuitSheet
        lawsuit={selected}
        onOpenChange={(open) => !open && setSelected(null)}
      />
      {target && isDocumentType(target.type) && (
        <AddPartyDialog
          documentType={target.type}
          open={adding}
          onOpenChange={setAdding}
          defaultDocument={target.key}
        />
      )}
    </>
  );
}

// O que a digitação reconheceu, ou o que ainda falta.
function RecognitionStatus({
  identification,
  target,
  onChoose,
  partyName,
}: {
  identification: ReturnType<typeof identify>;
  target: Candidate | null;
  onChoose: (type: SearchType) => void;
  partyName: string | null;
}) {
  if (identification.status === "empty") {
    return (
      <p className="text-sm text-muted-foreground">
        O tipo é reconhecido enquanto você digita.
      </p>
    );
  }
  if (identification.status !== "recognized") {
    return (
      <p
        className={cn(
          "text-sm",
          identification.status === "invalid"
            ? "text-destructive"
            : "text-muted-foreground",
        )}
      >
        {identification.message}
      </p>
    );
  }

  if (!target) return null;

  const alternatives = identification.candidates.filter(
    (c) => c.type !== target.type,
  );
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <StatusBadge tone="success">
          <CircleCheckIcon className="size-3" aria-hidden />
          Reconhecido: {SEARCH_TYPES[target.type].label}
        </StatusBadge>
        <span className="text-muted-foreground">
          {SEARCH_TYPES[target.type].description}
          {target.type !== "name" &&
            ` · ${formatSearchKey(target.type, target.key)}`}
        </span>
        {alternatives.length > 0 && (
          <Popover>
            <PopoverTrigger
              render={
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-xs"
                />
              }
            >
              Não é isso?
            </PopoverTrigger>
            <PopoverContent className="flex w-72 flex-col gap-1 p-2">
              {alternatives.map((c) => (
                <Button
                  key={c.type}
                  variant="ghost"
                  className="h-auto justify-start py-2 text-left whitespace-normal"
                  onClick={() => onChoose(c.type)}
                >
                  <span className="flex flex-col">
                    <span>É um {SEARCH_TYPES[c.type].label}</span>
                    <span className="text-xs text-muted-foreground">
                      {SEARCH_TYPES[c.type].description}
                    </span>
                  </span>
                </Button>
              ))}
            </PopoverContent>
          </Popover>
        )}
      </div>
      {identification.note && (
        <p className="text-xs text-muted-foreground">{identification.note}</p>
      )}
      {partyName && (
        <p className="text-xs text-muted-foreground">
          Já está na sua lista: {partyName}.
        </p>
      )}
      {target.type === "cpf" && (
        <p className="text-xs text-muted-foreground">
          CPF é dado pessoal: consulte só com base legal.
        </p>
      )}
    </div>
  );
}

function PayloadView({
  payload,
  onSelect,
  subjectLink,
}: {
  payload: ConsultPayload;
  onSelect: (lawsuit: Lawsuit) => void;
  subjectLink: string;
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
                    label={lowerFirst(group.title)}
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
            Consulta criada na JUDIT. O resultado chega depois: acompanhe na
            ficha do assunto, em Minhas informações.
          </p>
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href={subjectLink} />}
          >
            Acompanhar
          </Button>
        </div>
      );
  }
}
