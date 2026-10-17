"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { SearchType, TrackingSearchType } from "@/db/models";
import { runConsultAction } from "@/features/consult/actions";
import type { ConsultFeature } from "@/features/consult/catalog";
import {
  demoUnavailable,
  QuestionActions,
  QuestionOption,
} from "@/features/consult/components/question-parts";
import { useNewTrackingDialog } from "@/features/trackings/components/new-tracking-dialog";
import { SERVER_UNREACHABLE, useDemoStore } from "@/lib/demo-store";
import { lowerFirst } from "@/lib/format";

// "O que ainda não se sabe" (círculo 5): consultar e monitorar na própria
// ficha, em dois cliques (a pergunta e "Consultar"), sem voltar à página
// Consultar. A consulta é a mesma Server Action de Consultar; ela grava na
// base própria antes de responder, então basta reler a página no servidor
// (router.refresh) para o dado aparecer na seção dele e a pergunta sair
// daqui. Na demonstração, nada é gravado: o aviso diz isso.
export function AskHere({
  searchType,
  searchKey,
  features,
  consultHref,
}: {
  searchType: SearchType;
  searchKey: string;
  features: ConsultFeature[];
  consultHref: string;
}) {
  const router = useRouter();
  const { dataSource } = useDemoStore();
  const { openNewTracking } = useNewTrackingDialog();
  const [featureId, setFeatureId] = useState<string | null>(null);
  const [aiSummary, setAiSummary] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [running, startRun] = useTransition();

  const feature = features.find((f) => f.id === featureId) ?? null;
  const unavailable = demoUnavailable(dataSource, searchType);

  function run() {
    if (!feature) return;
    setError(null);
    startRun(async () => {
      try {
        const result = await runConsultAction({
          feature: feature.id,
          searchType,
          searchKey,
          aiSummary: feature.id === "lawsuit_async" ? aiSummary : undefined,
        });
        if (!result.ok) {
          setError(result.message);
          return;
        }
        if (result.demo) {
          toast.info("Resposta fictícia recebida", {
            description:
              "Na demonstração, a ficha não guarda resultados. A resposta aparece na página Consultar.",
            action: {
              label: "Abrir em Consultar",
              onClick: () => router.push(consultHref),
            },
          });
          return;
        }
        toast.success(
          result.payload.kind === "async"
            ? "Consulta enviada"
            : "Resposta recebida",
          {
            description:
              result.payload.kind === "async"
                ? "A resposta chega depois: acompanhe em “Consultas feitas”."
                : "O dado novo já está na ficha.",
          },
        );
        setFeatureId(null);
        router.refresh();
      } catch {
        setError(SERVER_UNREACHABLE);
      }
    });
  }

  function monitor() {
    if (!feature) return;
    openNewTracking({
      searchType: searchType as TrackingSearchType,
      searchKey,
      locked: true,
      alsoConsult: { question: lowerFirst(feature.question), run },
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>O que ainda não se sabe</CardTitle>
        <CardDescription>
          Perguntas que a JUDIT responde para este identificador e que ainda não
          foram feitas. Escolha uma para consultar aqui mesmo.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div
          role="radiogroup"
          aria-label="O que ainda não se sabe"
          className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3"
        >
          {features.map((f, index) => (
            <QuestionOption
              key={f.id}
              feature={f}
              searchType={searchType}
              active={f.id === featureId}
              index={index}
              onSelect={() => {
                setFeatureId(f.id);
                setError(null);
              }}
            />
          ))}
        </div>
        {feature && (
          // Desliza ao escolher a pergunta, como na página Consultar.
          <div
            key={feature.id}
            className="flex animate-in flex-col gap-4 duration-300 fade-in slide-in-from-top-2 motion-reduce:animate-none"
          >
            <QuestionActions
              featureId={feature.id}
              searchType={searchType}
              aiSummary={aiSummary}
              onAiSummaryChange={setAiSummary}
              running={running}
              unavailable={unavailable}
              onRun={run}
              onMonitor={monitor}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
