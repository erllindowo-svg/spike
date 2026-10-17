"use client";

import {
  FileSearchIcon,
  FolderSearchIcon,
  RadarIcon,
  SearchIcon,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { EmptyState } from "@/components/shared/empty-state";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { SearchType } from "@/db/models";
import { SEARCH_TYPES } from "@/features/consult/identify";
import { isQueryOpen, type QueryView } from "@/features/queries/types";
import type { SearchHit } from "@/features/search/hits";
import { parseQuery } from "@/features/search/terms";
import { useKnownSearch } from "@/features/search/use-known-search";
import { formatSearchKey } from "@/features/trackings/format";
import { getTrackingDisplayState } from "@/features/trackings/types";
import { useAppStore } from "@/lib/app-store";
import { formatDate, formatNumber } from "@/lib/format";

import {
  buildSubjects,
  filterSubjects,
  isSearchType,
  subjectHref,
  SUBJECT_TYPES,
  type Subject,
} from "../subjects";

// Acervo (círculo 3, fatia 6): a página de ler. No topo, os números; no
// meio, os assuntos (cada identificador pesquisado, monitorado ou salvo), que
// abrem a ficha. Nada aqui consulta a JUDIT: fazer fica na página Consultar.
// Desde o círculo 7, os alertas moram no menu do sino (alerts-menu.tsx); aqui
// sobra só a marca de alertas não lidos em cada assunto.

const PAGE_SIZE = 30;
const ACERVO_SEARCH_LIMIT = 50;

export function InfoPage({ queries }: { queries: QueryView[] }) {
  const searchParams = useSearchParams();
  const { parties, trackings, alerts } = useAppStore();
  const initialType = searchParams.get("tipo") ?? "";
  const [type, setType] = useState<SearchType | "all">(
    isSearchType(initialType) ? initialType : "all",
  );
  const [monitoredOnly, setMonitoredOnly] = useState(
    searchParams.get("monitorado") === "1",
  );
  const [text, setText] = useState("");
  const [shown, setShown] = useState(PAGE_SIZE);

  const subjects = buildSubjects({ queries, trackings, parties, alerts });
  // Com texto, a lista vem da busca do acervo (search_entries, no servidor):
  // acha também o que está dentro dos dados guardados, como o nome de uma
  // parte de um processo. Sem texto, a lista de assuntos de sempre.
  const searching = parseQuery(text) !== null;
  const found = useKnownSearch(text.trim(), ACERVO_SEARCH_LIMIT);
  const filtered = filterSubjects(subjects, { type, monitoredOnly, text: "" });
  const hits = Array.isArray(found)
    ? found.filter(
        (h) =>
          (type === "all" || h.searchType === type) &&
          (!monitoredOnly || h.monitored),
      )
    : [];
  const presentTypes = SUBJECT_TYPES.filter((t) =>
    subjects.some((s) => s.searchType === t),
  );

  const activeTrackings = trackings.filter(
    (t) => getTrackingDisplayState(t) === "active",
  ).length;
  const openQueries = queries.filter(isQueryOpen).length;

  return (
    <>
      <section
        aria-label="Números"
        className="grid grid-cols-2 gap-4 xl:grid-cols-3"
      >
        <StatCard
          label="Assuntos"
          value={formatNumber(subjects.length)}
          hint={`${formatNumber(subjects.filter((s) => s.monitored).length)} monitorados`}
          icon={FolderSearchIcon}
        />
        <StatCard
          label="Monitoramentos ativos"
          value={formatNumber(activeTrackings)}
          hint={`de ${formatNumber(trackings.length)} cadastrados`}
          icon={RadarIcon}
        />
        <StatCard
          label="Consultas"
          value={formatNumber(queries.length)}
          hint={
            openQueries > 0
              ? `${formatNumber(openQueries)} em andamento`
              : "Nenhuma em andamento"
          }
          icon={FileSearchIcon}
        />
      </section>

      <Card className="gap-0 py-0">
        <CardHeader className="border-b py-4">
          <CardTitle>Assuntos</CardTitle>
          <CardDescription>
            Cada identificador que você pesquisou, monitorou ou salvou. Abra um
            para ver tudo o que se sabe dele.
          </CardDescription>
        </CardHeader>
        <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center">
          <div className="relative w-full lg:max-w-xs">
            <SearchIcon
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setShown(PAGE_SIZE);
              }}
              placeholder="Pesquisar no acervo (3 letras ou mais)"
              aria-label="Filtrar assuntos"
              className="pl-8"
            />
          </div>
          <ToggleGroup
            variant="outline"
            spacing={0}
            size="sm"
            value={[type]}
            onValueChange={(next) => {
              if (next[0]) setType(next[0] as SearchType | "all");
              setShown(PAGE_SIZE);
            }}
            aria-label="Tipo de identificador"
            className="flex-wrap"
          >
            <ToggleGroupItem value="all">Todos</ToggleGroupItem>
            {presentTypes.map((t) => (
              <ToggleGroupItem key={t} value={t}>
                {SEARCH_TYPES[t].label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={monitoredOnly}
              onChange={(e) => setMonitoredOnly(e.target.checked)}
              className="size-4 accent-primary"
            />
            Só monitorados
          </label>
        </div>

        {searching ? (
          <SearchResults text={text.trim()} found={found} hits={hits} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={FolderSearchIcon}
            title={
              subjects.length === 0 ? "Nada pesquisado ainda" : "Nenhum assunto"
            }
            description={
              subjects.length === 0
                ? "O que você consultar ou monitorar aparece aqui."
                : "Nenhum assunto com esses filtros."
            }
            action={
              subjects.length === 0 ? (
                <Button nativeButton={false} render={<Link href="/" />}>
                  Fazer uma consulta
                </Button>
              ) : undefined
            }
            className="py-10"
          />
        ) : (
          <ul className="flex flex-col divide-y">
            {filtered.slice(0, shown).map((subject) => (
              <SubjectRow
                key={`${subject.searchType}:${subject.searchKey}`}
                subject={subject}
              />
            ))}
          </ul>
        )}
        {!searching && filtered.length > shown && (
          <div className="border-t p-3 text-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShown((n) => n + PAGE_SIZE)}
            >
              Mostrar mais ({formatNumber(filtered.length - shown)})
            </Button>
          </div>
        )}
      </Card>
    </>
  );
}

function SearchResults({
  text,
  found,
  hits,
}: {
  text: string;
  found: SearchHit[] | "error" | null;
  hits: SearchHit[];
}) {
  if (found === null) {
    return <p className="p-4 text-sm text-muted-foreground">Procurando…</p>;
  }
  if (found === "error") {
    return (
      <p className="p-4 text-sm text-destructive">
        A busca não respondeu agora. Tente de novo em instantes.
      </p>
    );
  }
  if (hits.length === 0) {
    return (
      <EmptyState
        icon={FolderSearchIcon}
        title="Dado não encontrado"
        description="Nada no seu acervo começa com esse texto, com esses filtros."
        action={
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href={`/?valor=${encodeURIComponent(text)}`} />}
          >
            Fazer nova consulta
          </Button>
        }
        className="py-10"
      />
    );
  }
  return (
    <ul className="flex flex-col divide-y">
      {hits.map((hit) => (
        <li key={`${hit.searchType}:${hit.searchKey}`}>
          <Link
            href={subjectHref(hit.searchType, hit.searchKey)}
            className="flex flex-col gap-0.5 px-4 py-3 outline-none hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <span className="truncate text-sm font-medium">{hit.label}</span>
            <span className="truncate text-xs text-muted-foreground">
              {hit.description}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function SubjectRow({ subject }: { subject: Subject }) {
  const key = formatSearchKey(subject.searchType, subject.searchKey);
  return (
    <li>
      <Link
        href={subjectHref(subject.searchType, subject.searchKey)}
        className="flex flex-col gap-1 px-4 py-3 outline-none hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring/50 sm:flex-row sm:items-center sm:gap-4"
      >
        <span className="flex min-w-0 flex-1 items-center gap-3">
          <span className="inline-flex h-5 shrink-0 items-center rounded-md border bg-muted/50 px-1.5 font-mono text-[11px] font-medium text-muted-foreground">
            {SEARCH_TYPES[subject.searchType].label}
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-medium">
              {subject.name ?? key}
            </span>
            {subject.name && subject.searchType !== "name" && (
              <span className="truncate font-mono text-xs text-muted-foreground">
                {key}
              </span>
            )}
          </span>
        </span>
        <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground sm:justify-end">
          {subject.unreadAlerts > 0 && (
            <StatusBadge tone="warning">
              {subject.unreadAlerts}{" "}
              {subject.unreadAlerts === 1 ? "alerta" : "alertas"}
            </StatusBadge>
          )}
          {subject.monitored && (
            <StatusBadge tone="success">
              <RadarIcon className="size-3" aria-hidden />
              Monitorado
            </StatusBadge>
          )}
          <span>
            {subject.queries === 0
              ? "Sem consultas"
              : `${subject.queries} ${subject.queries === 1 ? "consulta" : "consultas"}, a última em ${formatDate(subject.lastQueryAt!)}`}
          </span>
        </span>
      </Link>
    </li>
  );
}
