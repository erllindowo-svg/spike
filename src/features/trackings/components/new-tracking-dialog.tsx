"use client";

import { Building2Icon, InfoIcon, ScaleIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useState } from "react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
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
  cnpjSchema,
  formatCnpj,
  normalizeCnpj,
} from "@/features/companies/cnpj";
import { cnjSchema, formatCnj, normalizeCnj } from "@/features/processes/cnj";
import {
  formatRecurrence,
  recurrenceOptions,
  searchTypeDescriptions,
  type TrackingSearchType,
} from "@/features/trackings/types";
import { useDemoStore } from "@/lib/demo-store";

type Defaults = {
  searchType?: TrackingSearchType;
  searchKey?: string;
};

type ContextValue = { openNewTracking: (defaults?: Defaults) => void };

const NewTrackingContext = createContext<ContextValue | null>(null);

export function useNewTrackingDialog(): ContextValue {
  const value = useContext(NewTrackingContext);
  if (!value) {
    throw new Error("useNewTrackingDialog requer NewTrackingDialogProvider.");
  }
  return value;
}

export function NewTrackingDialogProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState<{ key: number; defaults: Defaults }>({
    key: 0,
    defaults: {},
  });

  const openNewTracking = useCallback((defaults: Defaults = {}) => {
    setSession((s) => ({ key: s.key + 1, defaults }));
    setOpen(true);
  }, []);

  return (
    <NewTrackingContext.Provider value={{ openNewTracking }}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <NewTrackingForm
            key={session.key}
            defaults={session.defaults}
            onDone={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </NewTrackingContext.Provider>
  );
}

const recurrenceItems = recurrenceOptions.map((days) => ({
  value: String(days),
  label: formatRecurrence(days),
}));

function NewTrackingForm({
  defaults,
  onDone,
}: {
  defaults: Defaults;
  onDone: () => void;
}) {
  const router = useRouter();
  const { addTracking, companies, lawsuits } = useDemoStore();
  const [searchType, setSearchType] = useState<TrackingSearchType>(
    defaults.searchType ?? "cnpj",
  );
  const [values, setValues] = useState<Record<TrackingSearchType, string>>({
    cnpj:
      defaults.searchType === "cnpj" && defaults.searchKey
        ? formatCnpj(defaults.searchKey)
        : "",
    cnj:
      defaults.searchType === "cnj" && defaults.searchKey
        ? formatCnj(defaults.searchKey)
        : "",
  });
  const [recurrence, setRecurrence] = useState("1");
  const [error, setError] = useState<string | null>(null);

  const value = values[searchType];
  const matchedCompany =
    searchType === "cnpj"
      ? companies.find((c) => c.cnpj === normalizeCnpj(value))
      : undefined;
  const matchedLawsuit =
    searchType === "cnj"
      ? lawsuits.find((l) => l.cnj === normalizeCnj(value))
      : undefined;
  const lawsuitCompany = matchedLawsuit?.companyId
    ? companies.find((c) => c.id === matchedLawsuit.companyId)
    : undefined;

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = (searchType === "cnpj" ? cnpjSchema : cnjSchema).safeParse(
      value,
    );
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Identificador inválido");
      return;
    }

    const result = addTracking({
      searchType,
      searchKey: parsed.data,
      companyId:
        searchType === "cnpj"
          ? (matchedCompany?.id ?? null)
          : (matchedLawsuit?.companyId ?? null),
      recurrenceDays: Number(recurrence),
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }

    onDone();
    toast.success("Monitoramento adicionado em modo de demonstração", {
      description:
        "Nenhum monitoramento foi criado na JUDIT. O item existe apenas nesta sessão do navegador.",
      action: {
        label: "Ver lista",
        onClick: () => router.push("/monitoramentos"),
      },
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      <DialogHeader>
        <DialogTitle>Novo monitoramento</DialogTitle>
        <DialogDescription>
          Escolha o que acompanhar: uma empresa, para descobrir novos processos,
          ou um processo específico, para receber suas movimentações.
        </DialogDescription>
      </DialogHeader>

      <FieldGroup className="gap-5">
        <Field>
          <FieldLabel>Tipo de monitoramento</FieldLabel>
          <ToggleGroup
            variant="outline"
            spacing={0}
            className="w-full"
            value={[searchType]}
            onValueChange={(next) => {
              const selected = next[0] as TrackingSearchType | undefined;
              if (selected) {
                setSearchType(selected);
                setError(null);
              }
            }}
          >
            <ToggleGroupItem value="cnpj" className="flex-1">
              <Building2Icon data-icon="inline-start" />
              Por CNPJ
            </ToggleGroupItem>
            <ToggleGroupItem value="cnj" className="flex-1">
              <ScaleIcon data-icon="inline-start" />
              Por número CNJ
            </ToggleGroupItem>
          </ToggleGroup>
          <FieldDescription>
            {searchTypeDescriptions[searchType]}.
          </FieldDescription>
        </Field>

        {searchType === "cnpj" ? (
          <Field data-invalid={!!error}>
            <FieldLabel htmlFor="tracking-cnpj">CNPJ da empresa</FieldLabel>
            <Input
              id="tracking-cnpj"
              autoFocus
              inputMode="text"
              placeholder="00.000.000/0000-00"
              value={values.cnpj}
              aria-invalid={!!error}
              onChange={(e) => {
                setValues((v) => ({ ...v, cnpj: e.target.value }));
                setError(null);
              }}
            />
            {error ? (
              <FieldError>{error}</FieldError>
            ) : (
              <FieldDescription>
                {matchedCompany
                  ? `Empresa encontrada nos dados de demonstração: ${matchedCompany.legalName ?? "razão social indisponível"}.`
                  : "Novos processos em que este CNPJ aparecer serão notificados."}
              </FieldDescription>
            )}
          </Field>
        ) : (
          <Field data-invalid={!!error}>
            <FieldLabel htmlFor="tracking-cnj">
              Número do processo (CNJ)
            </FieldLabel>
            <Input
              id="tracking-cnj"
              autoFocus
              inputMode="numeric"
              placeholder="0000000-00.0000.0.00.0000"
              value={values.cnj}
              aria-invalid={!!error}
              onChange={(e) => {
                setValues((v) => ({ ...v, cnj: e.target.value }));
                setError(null);
              }}
            />
            {error ? (
              <FieldError>{error}</FieldError>
            ) : (
              <FieldDescription>
                {matchedLawsuit
                  ? `Processo no ${matchedLawsuit.tribunal}${lawsuitCompany?.legalName ? ` · ${lawsuitCompany.legalName}` : ""}`
                  : "Movimentações deste processo serão notificadas."}
              </FieldDescription>
            )}
          </Field>
        )}

        <Field>
          <FieldLabel htmlFor="tracking-recurrence">Recorrência</FieldLabel>
          <Select
            items={recurrenceItems}
            value={recurrence}
            onValueChange={(next) => next && setRecurrence(next)}
          >
            <SelectTrigger id="tracking-recurrence" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {recurrenceItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldDescription>
            Intervalo entre execuções. Os valores aceitos serão confirmados na
            integração.
          </FieldDescription>
        </Field>
      </FieldGroup>

      <Alert>
        <InfoIcon />
        <AlertDescription>
          Modo de demonstração: o item é adicionado apenas à lista local.
          Nenhuma requisição é enviada à JUDIT.
        </AlertDescription>
      </Alert>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit">Adicionar monitoramento</Button>
      </DialogFooter>
    </form>
  );
}
