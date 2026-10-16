"use client";

import { Building2Icon, InfoIcon, ScaleIcon, UserIcon } from "lucide-react";
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
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  documentSchema,
  formatDocument,
  normalizeDocument,
} from "@/features/parties/documents";
import { cnjSchema, formatCnj, normalizeCnj } from "@/features/processes/cnj";
import { TRACKING_MODES, trackingModeFor } from "@/features/queries/modes";
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

// Cada tipo de identificador: rótulo, validação, formato e ajuda.
const searchTypeFields: Record<
  TrackingSearchType,
  {
    toggle: string;
    icon: typeof Building2Icon;
    label: string;
    placeholder: string;
    help: string;
  }
> = {
  cnpj: {
    toggle: "Por CNPJ",
    icon: Building2Icon,
    label: "CNPJ da empresa",
    placeholder: "00.000.000/0000-00",
    help: "Novos processos em que este CNPJ aparecer serão notificados.",
  },
  cpf: {
    toggle: "Por CPF",
    icon: UserIcon,
    label: "CPF da pessoa",
    placeholder: "000.000.000-00",
    help: "Novos processos em que este CPF aparecer serão notificados. CPF é dado pessoal: monitore só com base legal.",
  },
  cnj: {
    toggle: "Por número CNJ",
    icon: ScaleIcon,
    label: "Número do processo (CNJ)",
    placeholder: "0000000-00.0000.0.00.0000",
    help: "Movimentações deste processo serão notificadas.",
  },
};

const SEARCH_TYPES: TrackingSearchType[] = ["cnpj", "cpf", "cnj"];

function schemaFor(type: TrackingSearchType) {
  return type === "cnj" ? cnjSchema : documentSchema(type);
}

function formatKey(type: TrackingSearchType, key: string): string {
  return type === "cnj" ? formatCnj(key) : formatDocument(type, key);
}

function normalizeKey(type: TrackingSearchType, key: string): string {
  return type === "cnj" ? normalizeCnj(key) : normalizeDocument(type, key);
}

function NewTrackingForm({
  defaults,
  onDone,
}: {
  defaults: Defaults;
  onDone: () => void;
}) {
  const router = useRouter();
  const { addTracking, parties, lawsuits, dataSource } = useDemoStore();
  const [saving, setSaving] = useState(false);
  const [searchType, setSearchType] = useState<TrackingSearchType>(
    defaults.searchType ?? "cnpj",
  );
  const [values, setValues] = useState<Record<TrackingSearchType, string>>(
    () =>
      Object.fromEntries(
        SEARCH_TYPES.map((type) => [
          type,
          defaults.searchType === type && defaults.searchKey
            ? formatKey(type, defaults.searchKey)
            : "",
        ]),
      ) as Record<TrackingSearchType, string>,
  );
  // Padrão de 30 dias: no modo "db", cada execução na JUDIT pode ser cobrada.
  const [recurrence, setRecurrence] = useState("30");
  const [error, setError] = useState<string | null>(null);

  const value = values[searchType];
  const field = searchTypeFields[searchType];
  const matchedParty =
    searchType === "cnj"
      ? undefined
      : parties.find(
          (p) =>
            p.documentType === searchType &&
            p.document === normalizeKey(searchType, value),
        );
  const matchedLawsuit =
    searchType === "cnj"
      ? lawsuits.find((l) => l.cnj === normalizeCnj(value))
      : undefined;
  const lawsuitParty = matchedLawsuit?.partyId
    ? parties.find((p) => p.id === matchedLawsuit.partyId)
    : undefined;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    const parsed = schemaFor(searchType).safeParse(value);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Identificador inválido");
      return;
    }

    setSaving(true);
    const result = await addTracking({
      searchType,
      searchKey: parsed.data,
      partyId:
        searchType === "cnj"
          ? (matchedLawsuit?.partyId ?? null)
          : (matchedParty?.id ?? null),
      recurrenceDays: Number(recurrence),
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    onDone();
    const action = {
      label: "Ver lista",
      onClick: () => router.push("/monitoramentos"),
    };
    if (result.notice) {
      // Modo "db": a reserva foi gravada; o envio à JUDIT pode ter dado certo
      // ou não, e a mensagem diz o que aconteceu.
      const show = result.notice.sent ? toast.success : toast.warning;
      show(
        result.notice.sent
          ? "Monitoramento criado na JUDIT"
          : "Monitoramento reservado, mas não criado na JUDIT",
        { description: result.notice.message, action },
      );
      return;
    }
    toast.success("Monitoramento adicionado em modo de demonstração", {
      description:
        "Nenhum monitoramento foi criado na JUDIT. O item existe apenas nesta sessão do navegador.",
      action,
    });
  }

  const matchDescription =
    searchType === "cnj"
      ? matchedLawsuit
        ? `Processo no ${matchedLawsuit.tribunal}${lawsuitParty?.name ? ` · ${lawsuitParty.name}` : ""}`
        : null
      : matchedParty
        ? `${dataSource === "db" ? "Já na lista" : "Encontrado nos dados de demonstração"}: ${matchedParty.name ?? "nome não consultado"}.`
        : null;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      <DialogHeader>
        <DialogTitle>Novo monitoramento</DialogTitle>
        <DialogDescription>
          Escolha o que acompanhar: uma empresa ou uma pessoa, para descobrir
          novos processos, ou um processo específico, para receber suas
          movimentações.
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
            {SEARCH_TYPES.map((type) => {
              const Icon = searchTypeFields[type].icon;
              return (
                <ToggleGroupItem key={type} value={type} className="flex-1">
                  <Icon data-icon="inline-start" />
                  {searchTypeFields[type].toggle}
                </ToggleGroupItem>
              );
            })}
          </ToggleGroup>
          <FieldDescription>
            {searchTypeDescriptions[searchType]}.
          </FieldDescription>
        </Field>

        <Field data-invalid={!!error}>
          <FieldLabel htmlFor={`tracking-${searchType}`}>
            {field.label}
          </FieldLabel>
          <Input
            key={searchType}
            id={`tracking-${searchType}`}
            autoFocus
            inputMode={searchType === "cnpj" ? "text" : "numeric"}
            placeholder={field.placeholder}
            value={value}
            aria-invalid={!!error}
            onChange={(e) => {
              const next = e.target.value;
              setValues((v) => ({ ...v, [searchType]: next }));
              setError(null);
            }}
          />
          {error ? (
            <FieldError>{error}</FieldError>
          ) : (
            <FieldDescription>
              {matchDescription ?? field.help}
            </FieldDescription>
          )}
        </Field>

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
            Intervalo, em dias, entre as execuções na JUDIT.
          </FieldDescription>
        </Field>
      </FieldGroup>

      <Alert>
        <InfoIcon />
        <AlertDescription>
          {dataSource === "db"
            ? `${TRACKING_MODES[trackingModeFor(searchType)].label}: cria um monitoramento real na JUDIT (POST /tracking), que roda a cada N dias e gera cobrança recorrente até ser pausado ou excluído. A primeira execução acontece em até 24 horas.`
            : "Modo de demonstração: o item é adicionado apenas à lista local. Nenhuma requisição é enviada à JUDIT."}
        </AlertDescription>
      </Alert>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <Spinner data-icon="inline-start" />}
          {dataSource === "db" ? "Criar na JUDIT" : "Adicionar monitoramento"}
        </Button>
      </DialogFooter>
    </form>
  );
}
