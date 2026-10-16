"use client";

import {
  Building2Icon,
  CloudDownloadIcon,
  RadarIcon,
  ScaleIcon,
  SearchIcon,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { useDemoStore } from "@/lib/demo-store";
import { cn } from "@/lib/utils";

import { buildSuggestions, type SearchSuggestion } from "./search-suggestions";

const kindIcons: Record<SearchSuggestion["kind"], LucideIcon> = {
  party: Building2Icon,
  tracking: RadarIcon,
  lawsuit: ScaleIcon,
  consult: CloudDownloadIcon,
};

// Barra de pesquisa do cabeçalho (escolha R4 do escopo): sugere o que o app
// já tem (empresas, pessoas, monitoramentos, processos) enquanto se digita, e
// oferece "Consultar na JUDIT" para um identificador completo. Teclado:
// "/" foca, setas escolhem, Enter abre, Esc fecha.
export function GlobalSearch() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const { parties, trackings, lawsuits } = useDemoStore();

  const suggestions = buildSuggestions(query, { parties, trackings, lawsuits });
  const showList = open && query.trim().length >= 2;

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

  function go(suggestion: SearchSuggestion) {
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
    router.push(suggestion.href);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!suggestions.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActive((i) => (i + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => (i - 1 + suggestions.length) % suggestions.length);
    }
  }

  return (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        const chosen = suggestions[active] ?? suggestions[0];
        if (chosen) go(chosen);
      }}
      className="relative w-full max-w-md"
    >
      <SearchIcon
        className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        ref={inputRef}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        // O atraso deixa o clique numa sugestão acontecer antes de fechar.
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKeyDown}
        placeholder="Buscar empresa, pessoa, CNPJ, CPF ou CNJ"
        aria-label="Busca global por nome, CNPJ, CPF ou número CNJ"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          showList && suggestions[active] ? `${listId}-${active}` : undefined
        }
        className="bg-background pr-8 pl-8"
      />
      <Kbd className="pointer-events-none absolute top-1/2 right-2 hidden -translate-y-1/2 sm:inline-flex">
        /
      </Kbd>
      {showList && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Sugestões"
          className="absolute top-full right-0 left-0 z-50 mt-1 max-h-96 overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10"
        >
          {suggestions.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">
              Nada no app com esse nome. Para consultar na JUDIT, digite o CNPJ,
              CPF ou número CNJ completo.
            </li>
          ) : (
            suggestions.map((suggestion, index) => {
              const Icon = kindIcons[suggestion.kind];
              return (
                <li
                  key={suggestion.id}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={index === active}
                  // mousedown: acontece antes do blur do campo.
                  onMouseDown={(event) => {
                    event.preventDefault();
                    go(suggestion);
                  }}
                  onMouseEnter={() => setActive(index)}
                  className={cn(
                    "flex cursor-pointer items-start gap-2.5 rounded-md px-2.5 py-2 text-sm",
                    index === active && "bg-muted",
                    suggestion.kind === "consult" &&
                      "mt-1 border-t pt-2.5 text-primary",
                  )}
                >
                  <Icon
                    className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">
                      {suggestion.label}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {suggestion.description}
                    </span>
                  </span>
                </li>
              );
            })
          )}
        </ul>
      )}
    </form>
  );
}
