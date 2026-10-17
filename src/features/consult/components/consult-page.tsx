"use client";

import {
  ChevronRightIcon,
  CircleCheckIcon,
  ExternalLinkIcon,
  FlaskConicalIcon,
  LibraryBigIcon,
  PlusIcon,
  RadarIcon,
  SearchIcon,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { DistributionChart } from "@/components/shared/distribution-chart";
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
import {
  getTrackingDisplayState,
  trackingDisplayLabels,
} from "@/features/trackings/types";
import { getSubjectContextAction } from "@/features/subjects/actions";
import {
  lastFetch,
  LawsuitsBody,
  QueriesTable,
  RegistrationsList,
  StatsBody,
  WarrantsList,
} from "@/features/subjects/components/subject-sections";
import type { SubjectContext } from "@/lib/data";
import { formatDateTime, formatNumber, lowerFirst } from "@/lib/format";
import { cn } from "@/lib/utils";

import { runConsultAction, type ConsultResult } from "../actions";
import {
  featureInfo,
  featuresFor,
  purposeFor,
  trackingFor,
  type ConsultFeatureId,
} from "../catalog";
import {
  fieldDisplay,
  formatSearchKey,
  identify,
  SEARCH_TYPES,
  stripFieldMask,
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
  "CPF, CNPJ, número de processo (CNJ), OAB com UF, RJI (mandados) ou nome.";

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
  // O que já se sabe do identificador reconhecido (círculo 3B), guardado
  // com a chave a que se refere: uma resposta de outro identificador não
  // aparece.
  const [context, setContext] = useState<{
    key: string;
    data: SubjectContext | null;
  } | null>(null);

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
  // Os dados fictícios só têm empresas, pessoas e processos (D7).
  const demoUnavailable =
    dataSource !== "db" &&
    !!target &&
    target.type !== "cnj" &&
    !isDocumentType(target.type);
  const party =
    target && isDocumentType(target.type)
      ? parties.find(
          (p) => p.documentType === target.type && p.document === target.key,
        )
      : undefined;

  // "Fazer nova consulta" na barra do topo navega para /?valor=…, também
  // quando a página já está aberta: o campo acompanha a URL nova (ajuste de
  // estado durante a renderização, o padrão do React para "quando a prop
  // muda").
  const urlValue = searchParams.get("valor") ?? "";
  const urlType = searchParams.get("tipo") as SearchType | null;
  const [lastUrl, setLastUrl] = useState(`${urlType}:${urlValue}`);
  if (lastUrl !== `${urlType}:${urlValue}`) {
    setLastUrl(`${urlType}:${urlValue}`);
    setValue(urlValue);
    setChosenType(urlType);
    setResult(null);
  }

  // Campo no meio da tela até o primeiro reconhecimento (círculo 5); daí
  // ele sobe e só volta ao meio com a caixa vazia, para a página não subir
  // e descer enquanto se digita (um CPF deixa de ser reconhecido no 12º
  // dígito, a caminho de um CNPJ). Ajuste de estado durante a renderização,
  // como o da URL acima: com um identificador já na URL, a página abre em
  // cima, sem animação.
  const [raised, setRaised] = useState(false);
  if (target && !raised) setRaised(true);
  if (!target && raised && value.trim() === "") setRaised(false);

  const targetKey = target ? `${target.type}:${target.key}` : null;
  const known = context?.key === targetKey ? context.data : null;
  const isKnown = !!known?.known;

  // Lê o banco quando um identificador é reconhecido, e de novo depois de
  // cada consulta (o "Já capturado" ganha o que acabou de chegar). Uma
  // resposta que chega depois de outro identificador ser digitado é
  // descartada.
  const targetType = target?.type ?? null;
  const targetValue = target?.key ?? null;
  useEffect(() => {
    if (!targetType || !targetValue) return;
    let current = true;
    void fetchContext(targetType, targetValue).then((next) => {
      if (current) setContext(next);
    });
    return () => {
      current = false;
    };
  }, [targetType, targetValue]);

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
    const subject = { type: target.type, key: target.key };
    startRun(async () => {
      try {
        setResult(await runConsultAction(input));
      } catch {
        setResult({ ok: false, reason: "error", message: SERVER_UNREACHABLE });
      }
      setContext(await fetchContext(subject.type, subject.key));
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
      {/* O deslize: a altura mínima vai da tela inteira a zero, e o campo,
          centralizado nela, sobe junto; o cartão se alarga até a largura da
          página (só CSS). */}
      <div
        className={cn(
          "flex flex-col justify-center transition-[min-height] duration-500 ease-out motion-reduce:transition-none",
          raised
            ? "min-h-0"
            : "min-h-[calc(100svh-3.5rem-2rem)] md:min-h-[calc(100svh-3.5rem-3rem)]",
        )}
      >
        <Card
          className={cn(
            "mx-auto w-full transition-[max-width] duration-500 ease-out motion-reduce:transition-none",
            raised ? "max-w-7xl" : "max-w-2xl",
          )}
        >
          <CardContent className="flex flex-col gap-3">
            {/* Com um identificador conhecido, as instruções se recolhem e o
              nome aparece em cima do campo; apagando um dígito, voltam. */}
            <Collapse open={!isKnown}>
              <div className="flex flex-col gap-1.5 pb-1">
                <h2 className="font-heading text-lg font-medium">
                  Qual documento você quer consultar?
                </h2>
              </div>
            </Collapse>
            <Collapse open={isKnown}>
              {target && known && (
                <div className="flex flex-col gap-0.5 pb-1">
                  <span className="text-xs text-muted-foreground">
                    {SEARCH_TYPES[target.type].description}
                  </span>
                  <h2 className="font-heading text-xl font-semibold tracking-tight">
                    {known.name ?? formatSearchKey(target.type, target.key)}
                  </h2>
                </div>
              )}
            </Collapse>
            <IdentifierField
              value={value}
              target={target}
              invalid={identification.status === "invalid"}
              onChange={changeValue}
              onEnter={() => {
                if (target && !running) run();
              }}
            />
            <div id="consult-status" aria-live="polite" className="min-h-6">
              <RecognitionStatus
                identification={identification}
                target={target}
                onChoose={(type) => {
                  setChosenType(type);
                  setResult(null);
                }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {target && feature && (
        <Card className="animate-in duration-500 fade-in slide-in-from-bottom-4 motion-reduce:animate-none">
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
              {features.map((f, index) => {
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
                    // As perguntas entram deslizando, uma depois da outra.
                    style={{ animationDelay: `${150 + index * 60}ms` }}
                    className={cn(
                      "flex animate-in flex-col items-start gap-1.5 rounded-lg border p-3 text-left text-sm transition fill-mode-backwards outline-none fade-in slide-in-from-bottom-3 hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring/50 motion-reduce:animate-none",
                      active && "border-primary ring-1 ring-primary/40",
                    )}
                  >
                    <span className="font-medium">{f.question}</span>
                    <span className="text-xs text-muted-foreground">
                      {info.label}
                    </span>
                    <span className="flex flex-wrap items-center gap-1.5 pt-1">
                      {/* Verde e azul: as duas existem; cinza pareceria
                          desabilitado (círculo 3B). */}
                      <StatusBadge
                        tone={info.flow === "sync" ? "success" : "info"}
                      >
                        {info.flow === "sync" ? "Agora" : "Depois"}
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
              {purposeFor(feature.id, target.type)}
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
              <Button onClick={run} disabled={running || demoUnavailable}>
                {running ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <SearchIcon data-icon="inline-start" />
                )}
                Consultar
              </Button>
              {tracking && (
                <Button
                  variant="outline"
                  onClick={() => monitor(true)}
                  disabled={demoUnavailable}
                >
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
            {demoUnavailable && (
              <p className="text-sm text-warning">
                Indisponível na demonstração: os dados fictícios só têm
                empresas, pessoas e processos.
              </p>
            )}
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

      {target && known?.known && (
        <CapturedCard
          searchType={target.type}
          searchKey={target.key}
          context={known}
          onSelect={setSelected}
        />
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

async function fetchContext(
  type: SearchType,
  key: string,
): Promise<{ key: string; data: SubjectContext | null }> {
  try {
    const data = await getSubjectContextAction({
      searchType: type,
      searchKey: key,
    });
    return { key: `${type}:${key}`, data };
  } catch {
    return { key: `${type}:${key}`, data: null };
  }
}

// Abre e fecha com animação só de CSS: a linha da grade vai de 0 à altura
// do conteúdo. Fechado, o conteúdo fica inerte (fora do foco e do leitor de
// tela).
function Collapse({
  open,
  children,
}: {
  open: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      inert={!open}
      className={cn(
        "grid transition-[grid-template-rows,opacity] duration-300 ease-out",
        open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
      )}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}

// "Já capturado deste identificador" (círculo 3B): abaixo das ações, porque
// serve de referência ("já fiz esta consulta?") e não deve interromper o
// fluxo. Cada seção abre com um clique e diz de quando é o dado.
function CapturedCard({
  searchType,
  searchKey,
  context,
  onSelect,
}: {
  searchType: SearchType;
  searchKey: string;
  context: SubjectContext;
  onSelect: (lawsuit: Lawsuit) => void;
}) {
  const { trackings } = useDemoStore();
  const { view, queries } = context;
  const lawsuits = view.lawsuits.filter((l) => l.kind === "lawsuit");
  const executions = view.lawsuits.filter((l) => l.kind === "execution");
  const count = view.stats.find((s) => s.mode === "datalake_count");
  const synthetic = view.stats.find((s) => s.mode === "datalake_synthetic");
  const ownTrackings = trackings.filter(
    (t) =>
      t.searchType === searchType &&
      t.searchKey === searchKey &&
      t.status !== "deleted",
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Já capturado deste identificador</CardTitle>
        <CardDescription>
          O que já está no seu acervo. Abra uma seção para ver.
        </CardDescription>
        <CardAction>
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href={subjectHref(searchType, searchKey)} />}
          >
            <LibraryBigIcon data-icon="inline-start" />
            Abrir no Acervo
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col">
        {view.registrations.length > 0 && (
          <Section
            title="Dados cadastrais"
            when={view.registrations[0].fetchedAt}
          >
            <RegistrationsList registrations={view.registrations} />
          </Section>
        )}
        {(count || synthetic) && (
          <Section
            title="Números"
            when={(synthetic ?? count)?.fetchedAt ?? null}
          >
            <StatsBody count={count} synthetic={synthetic} />
          </Section>
        )}
        {lawsuits.length > 0 && (
          <Section
            title={`Processos (${formatNumber(lawsuits.length)})`}
            when={lastFetch(lawsuits) ?? null}
          >
            <LawsuitsBody lawsuits={lawsuits} onSelect={onSelect} />
          </Section>
        )}
        {executions.length > 0 && (
          <Section
            title={`Execuções penais (${formatNumber(executions.length)})`}
            when={lastFetch(executions) ?? null}
          >
            <LawsuitsBody lawsuits={executions} onSelect={onSelect} />
          </Section>
        )}
        {view.warrants.length > 0 && (
          <Section
            title={`Mandados de prisão (${formatNumber(view.warrants.length)})`}
            when={view.warrants[0].fetchedAt}
          >
            <WarrantsList warrants={view.warrants} />
          </Section>
        )}
        {ownTrackings.length > 0 && (
          <Section title="Monitoramento" when={null}>
            <ul className="flex flex-col gap-1 text-sm">
              {ownTrackings.map((t) => (
                <li key={t.id}>
                  {trackingDisplayLabels[getTrackingDisplayState(t)]}
                  {t.delivery === "webhook"
                    ? " · resultados chegam por webhook"
                    : " · resultados em “Ver resultados”, no Acervo"}
                </li>
              ))}
            </ul>
          </Section>
        )}
        {queries.length > 0 && (
          <Section
            title={`Consultas feitas (${formatNumber(queries.length)})`}
            when={queries[0].createdAt}
            whenLabel="a última em"
          >
            <QueriesTable queries={queries} />
          </Section>
        )}
      </CardContent>
    </Card>
  );
}

function Section({
  title,
  when,
  whenLabel = "consultado em",
  children,
}: {
  title: string;
  when: Date | null;
  whenLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group border-t py-3 first:border-t-0 first:pt-0">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
        <ChevronRightIcon
          className="size-4 text-muted-foreground transition-transform group-open:rotate-90"
          aria-hidden
        />
        {title}
        {when && (
          <span className="ml-auto text-xs font-normal text-muted-foreground">
            {whenLabel} {formatDateTime(when)}
          </span>
        )}
      </summary>
      <div className="pt-3">{children}</div>
    </details>
  );
}

// O que aparece antes do número, dentro do campo: para CPF e CNPJ, quem é
// ("Pessoa física", "Empresa"); para os outros, o nome do tipo.
function fieldPrefix(type: SearchType): string {
  return type === "cpf" || type === "cnpj"
    ? SEARCH_TYPES[type].description
    : SEARCH_TYPES[type].label;
}

// O campo do identificador (círculo 3B). Reconhecido o tipo, aparece dentro
// do próprio campo, em verde, o que ele é ("Pessoa física:") e, em CPF, CNPJ
// e CNJ, os separadores como caracteres da caixa (`fieldDisplay`). O estado
// guarda o valor sem eles (`stripFieldMask`): um dígito a mais ou um apagar
// voltam a mostrar só os números até o tipo ser reconhecido de novo.
function IdentifierField({
  value,
  target,
  invalid,
  onChange,
  onEnter,
}: {
  value: string;
  target: Candidate | null;
  invalid: boolean;
  onChange: (value: string) => void;
  onEnter: () => void;
}) {
  const display = fieldDisplay(value, target);

  return (
    <div
      aria-invalid={invalid}
      className="flex h-12 max-w-2xl items-center gap-2 rounded-lg border border-input bg-transparent px-3 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:bg-input/30"
    >
      {target && (
        <span className="flex shrink-0 items-center gap-1.5 text-sm font-medium text-success">
          <CircleCheckIcon className="size-4" aria-hidden />
          {fieldPrefix(target.type)}:
        </span>
      )}
      <input
        id="consult-value"
        autoFocus
        value={display ?? value}
        placeholder="Digite o identificador"
        onChange={(e) =>
          onChange(display ? stripFieldMask(e.target.value) : e.target.value)
        }
        onKeyDown={(e) => {
          if (e.key === "Enter") onEnter();
        }}
        aria-label="Identificador"
        aria-invalid={invalid}
        aria-describedby="consult-status"
        autoComplete="off"
        spellCheck={false}
        className="min-w-0 flex-1 bg-transparent font-mono text-base outline-none placeholder:text-muted-foreground md:text-lg"
      />
    </div>
  );
}

// O que a digitação reconheceu, ou o que ainda falta.
function RecognitionStatus({
  identification,
  target,
  onChoose,
}: {
  identification: ReturnType<typeof identify>;
  target: Candidate | null;
  onChoose: (type: SearchType) => void;
}) {
  if (identification.status === "empty") {
    return <p className="text-sm text-muted-foreground">{TYPE_HINT}</p>;
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
  // O tipo reconhecido aparece dentro do campo (IdentifierField); aqui
  // ficam só o "Não é isso?", a nota e o aviso para o leitor de tela.
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="sr-only">
          Reconhecido: {SEARCH_TYPES[target.type].label}{" "}
          {formatSearchKey(target.type, target.key)}
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
            ficha do assunto, em Acervo.
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
