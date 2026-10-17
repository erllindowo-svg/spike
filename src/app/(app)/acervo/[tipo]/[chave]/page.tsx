import { ChevronLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { PageSkeleton } from "@/components/shared/page-skeleton";
import { Button } from "@/components/ui/button";
import {
  displaySearchKey,
  parseSearchKey,
  SEARCH_TYPES,
} from "@/features/consult/identify";
import { SubjectPage } from "@/features/subjects/components/subject-page";
import { isSearchType } from "@/features/subjects/subjects";
import { getSubjectView, listQueries, staticParamSamples } from "@/lib/data";

type Props = PageProps<"/acervo/[tipo]/[chave]">;

export function generateStaticParams() {
  return staticParamSamples.subjects();
}

// O tipo e a chave da URL passam pela mesma regra da página Consultar: uma
// chave fora do formato é 404, e uma chave com máscara vira a forma gravada.
async function readSubject(params: Props["params"]) {
  const { tipo, chave } = await params;
  if (!isSearchType(tipo)) return null;
  const searchKey = parseSearchKey(tipo, decodeURIComponent(chave));
  return searchKey ? { searchType: tipo, searchKey } : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const subject = await readSubject(params);
  return {
    // O CPF entra mascarado no título da aba (dado pessoal).
    title: subject
      ? `${SEARCH_TYPES[subject.searchType].label} ${displaySearchKey(subject.searchType, subject.searchKey)}`
      : "Assunto",
  };
}

// params é lido dentro do Suspense para que o shell da rota continue estático.
export default function SubjectRoute({ params }: Props) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <SubjectContent params={params} />
    </Suspense>
  );
}

async function SubjectContent({ params }: Pick<Props, "params">) {
  const subject = await readSubject(params);
  if (!subject) notFound();
  const [view, queries] = await Promise.all([
    getSubjectView(subject.searchType, subject.searchKey),
    listQueries(),
  ]);

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 w-fit text-muted-foreground"
        nativeButton={false}
        render={<Link href="/acervo" />}
      >
        <ChevronLeftIcon data-icon="inline-start" />
        Acervo
      </Button>
      <SubjectPage
        searchType={subject.searchType}
        searchKey={subject.searchKey}
        view={view}
        queries={queries.filter(
          (q) =>
            q.searchType === subject.searchType &&
            q.searchKey === subject.searchKey,
        )}
      />
    </>
  );
}
