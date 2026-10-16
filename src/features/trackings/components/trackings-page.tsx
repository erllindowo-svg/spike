"use client";

import { PlusIcon, RadarIcon, SearchIcon } from "lucide-react";
import { useState } from "react";

import { EmptyState } from "@/components/shared/empty-state";
import { PageIntro } from "@/components/shared/page-intro";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  getTrackingDisplayState,
  trackingDisplayLabels,
  type TrackingDisplayState,
  type TrackingSearchType,
} from "@/features/trackings/types";
import { useDemoStore } from "@/lib/demo-store";
import { cn } from "@/lib/utils";

import { useNewTrackingDialog } from "./new-tracking-dialog";
import { TrackingsTable } from "./trackings-table";

const summaryStates: TrackingDisplayState[] = [
  "active",
  "pending_first_run",
  "paused",
  "failed",
  "completed",
];

// O filtro também alcança os estados da criação na JUDIT, que não têm
// cartão de resumo.
const filterStates: TrackingDisplayState[] = [
  ...summaryStates,
  "not_sent",
  "uncertain",
  "rejected",
];

const stateItems = [
  { value: "all", label: "Todos os status" },
  ...filterStates.map((s) => ({ value: s, label: trackingDisplayLabels[s] })),
];

export function TrackingsPage() {
  const { trackings, getParty } = useDemoStore();
  const { openNewTracking } = useNewTrackingDialog();
  const [query, setQuery] = useState("");
  const [type, setType] = useState<TrackingSearchType | "all">("all");
  const [state, setState] = useState<string>("all");

  const counts = Object.fromEntries(
    summaryStates.map((s) => [
      s,
      trackings.filter((t) => getTrackingDisplayState(t) === s).length,
    ]),
  ) as Record<TrackingDisplayState, number>;

  const term = query.trim().toLowerCase();
  const digits = term.replace(/[^0-9a-z]/g, "");
  const filtered = trackings.filter((t) => {
    if (type !== "all" && t.searchType !== type) return false;
    if (state !== "all" && getTrackingDisplayState(t) !== state) {
      return false;
    }
    if (!term) return true;
    const company = getParty(t.partyId);
    return (
      (digits.length > 0 && t.searchKey.toLowerCase().includes(digits)) ||
      !!company?.name?.toLowerCase().includes(term)
    );
  });
  const hasFilters = !!term || type !== "all" || state !== "all";

  return (
    <>
      <PageIntro description="Monitoramentos por CNPJ descobrem novos processos de uma empresa; por CNJ acompanham as movimentações de um processo específico.">
        <Button onClick={() => openNewTracking()}>
          <PlusIcon data-icon="inline-start" />
          Novo monitoramento
        </Button>
      </PageIntro>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {summaryStates.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setState(state === s ? "all" : s)}
            aria-pressed={state === s}
            className={cn(
              "flex flex-col items-start gap-1 rounded-xl bg-card p-3 text-left ring-1 ring-foreground/10 transition outline-none hover:ring-primary/40 focus-visible:ring-2 focus-visible:ring-ring",
              state === s && "ring-2 ring-primary/60",
            )}
          >
            <span className="text-xs text-muted-foreground">
              {trackingDisplayLabels[s]}
            </span>
            <span className="text-xl font-semibold tabular-nums">
              {counts[s]}
            </span>
          </button>
        ))}
      </div>

      <Card className="gap-0 py-0">
        <div className="flex flex-col gap-2 border-b p-4 lg:flex-row lg:items-center">
          <div className="relative w-full lg:max-w-sm">
            <SearchIcon
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por identificador ou empresa"
              aria-label="Buscar monitoramentos"
              className="pl-8"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
            <ToggleGroup
              variant="outline"
              spacing={0}
              size="sm"
              value={[type]}
              onValueChange={(v) =>
                v[0] && setType(v[0] as TrackingSearchType | "all")
              }
              aria-label="Tipo de monitoramento"
            >
              <ToggleGroupItem value="all">Todos</ToggleGroupItem>
              <ToggleGroupItem value="cnpj">CNPJ</ToggleGroupItem>
              <ToggleGroupItem value="cnj">CNJ</ToggleGroupItem>
            </ToggleGroup>
            <Select
              items={stateItems}
              value={state}
              onValueChange={(v) => v && setState(v)}
            >
              <SelectTrigger size="sm" className="w-56" aria-label="Status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {stateItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <CardContent className="px-2">
          {filtered.length === 0 ? (
            <EmptyState
              icon={RadarIcon}
              title={
                hasFilters
                  ? "Nenhum monitoramento corresponde aos filtros"
                  : "Nenhum monitoramento cadastrado"
              }
              description={
                hasFilters
                  ? "Ajuste a busca, o tipo ou o status."
                  : "Cadastre um monitoramento por CNPJ ou por número CNJ para começar."
              }
              action={
                hasFilters ? (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setQuery("");
                      setType("all");
                      setState("all");
                    }}
                  >
                    Limpar filtros
                  </Button>
                ) : (
                  <Button onClick={() => openNewTracking()}>
                    Novo monitoramento
                  </Button>
                )
              }
            />
          ) : (
            <TrackingsTable trackings={filtered} />
          )}
        </CardContent>
      </Card>
    </>
  );
}
