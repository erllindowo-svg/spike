"use client";

import {
  CircleOffIcon,
  LibraryBigIcon,
  NotebookPenIcon,
  type LucideIcon,
  SearchIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { useKnownSearch } from "@/features/search/use-known-search";
import { cn } from "@/lib/utils";

import { buildSuggestions, type SearchSuggestion } from "./search-suggestions";

const kindIcons: Record<SearchSuggestion["kind"], LucideIcon> = {
  hit: LibraryBigIcon,
  consult: NotebookPenIcon,
  notice: CircleOffIcon,
};

// Barra de pesquisa do cabeçalho (círculo 3B): uma só, igual em todas as
// páginas, como a do Google. Procura no acervo (search_entries, no servidor)
// enquanto se digita; o melhor resultado vem primeiro, "Fazer nova
// consulta" logo depois. Teclado: "/" foca, setas escolhem, Enter abre, Esc
// fecha.
export function GlobalSearch({
  onNavigate,
}: {
  // Chamado ao abrir uma sugestão (no celular, fecha a linha da pesquisa).
  onNavigate?: () => void;
} = {}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const found = useKnownSearch(query.trim());
  const suggestions = buildSuggestions(query, found);
  // Os avisos ("Dado não encontrado") aparecem, mas não são escolhidos.
  const options = suggestions.filter(
    (s): s is Extract<SearchSuggestion, { href: string }> =>
      s.kind !== "notice",
  );
  const showList = open && suggestions.length > 0;

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

  function go(suggestion: (typeof options)[number]) {
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
    onNavigate?.();
    router.push(suggestion.href);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!options.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActive((i) => (i + 1) % options.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => (i - 1 + options.length) % options.length);
    }
  }

  return (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        const chosen = options[active] ?? options[0];
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
        placeholder="Pesquisar no acervo ou fazer nova consulta"
        aria-label="Busca por nome, CPF, CNPJ, processo, OAB ou RJI"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          showList && options[active]
            ? `${listId}-${options[active].id}`
            : undefined
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
          {suggestions.map((suggestion) => {
            const Icon = kindIcons[suggestion.kind];
            if (suggestion.kind === "notice") {
              return (
                <li
                  key={suggestion.id}
                  role="presentation"
                  className="flex items-start gap-2.5 px-2.5 py-2 text-sm text-muted-foreground"
                >
                  <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <span className="flex min-w-0 flex-col">
                    <span className="font-medium">{suggestion.label}</span>
                    <span className="text-xs">{suggestion.description}</span>
                  </span>
                </li>
              );
            }
            const index = options.indexOf(suggestion);
            return (
              <li
                key={suggestion.id}
                id={`${listId}-${suggestion.id}`}
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
                  suggestion.kind === "consult" && "text-primary",
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
          })}
        </ul>
      )}
    </form>
  );
}
