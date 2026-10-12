"use client";

import { SearchIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { isValidCnpj, normalizeCnpj } from "@/features/companies/cnpj";
import { isValidCnj, normalizeCnj } from "@/features/processes/cnj";
import { useNewTrackingDialog } from "@/features/trackings/components/new-tracking-dialog";
import { useDemoStore } from "@/lib/demo-store";

export function GlobalSearch() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const { companies, lawsuits } = useDemoStore();
  const { openNewTracking } = useNewTrackingDialog();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.isContentEditable ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName ?? "");
      if (event.key === "/" && !typing) {
        event.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function notFound(kind: "cnpj" | "cnj", key: string) {
    toast.info(
      kind === "cnpj"
        ? "CNPJ não encontrado nos dados de demonstração"
        : "Processo não encontrado nos dados de demonstração",
      {
        description:
          "A consulta real à JUDIT será habilitada na etapa de integração.",
        action: {
          label: "Monitorar",
          onClick: () => openNewTracking({ searchType: kind, searchKey: key }),
        },
      },
    );
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const value = query.trim();
    if (!value) return;

    const cnj = normalizeCnj(value);
    const cnpj = normalizeCnpj(value);

    if (cnj.length === 20 && /^[\d.\-\s]+$/.test(value)) {
      if (!isValidCnj(cnj)) {
        toast.error("Número CNJ inválido", {
          description: "Confira os dígitos verificadores.",
        });
        return;
      }
      const lawsuit = lawsuits.find((l) => l.cnj === cnj);
      if (!lawsuit) return notFound("cnj", cnj);
      setQuery("");
      router.push(`/processos/${cnj}`);
      return;
    }

    if (cnpj.length === 14 && /\d{2}$/.test(cnpj)) {
      if (!isValidCnpj(cnpj)) {
        toast.error("CNPJ inválido", {
          description: "Confira os dígitos verificadores.",
        });
        return;
      }
      const company = companies.find((c) => c.cnpj === cnpj);
      if (!company) return notFound("cnpj", cnpj);
      setQuery("");
      router.push(`/empresas/${cnpj}`);
      return;
    }

    setQuery("");
    router.push(`/empresas?q=${encodeURIComponent(value)}`);
  }

  return (
    <form
      role="search"
      onSubmit={handleSubmit}
      className="relative w-full max-w-md"
    >
      <SearchIcon
        className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        ref={inputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar por CNPJ, número CNJ ou razão social"
        aria-label="Busca global por CNPJ, número CNJ ou razão social"
        className="bg-background pr-8 pl-8"
      />
      <Kbd className="pointer-events-none absolute top-1/2 right-2 hidden -translate-y-1/2 sm:inline-flex">
        /
      </Kbd>
    </form>
  );
}
