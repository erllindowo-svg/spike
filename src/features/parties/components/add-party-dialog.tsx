"use client";

import { InfoIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
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
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useDemoStore } from "@/lib/demo-store";

import {
  documentSchema,
  DOCUMENTS,
  formatDocument,
  normalizeDocument,
  partyHref,
  type DocumentType,
} from "../documents";

// Adicionar uma empresa ou pessoa física à lista sem criar um monitoramento
// (círculos 1 e 2 do escopo). No protótipo, a parte fica só na memória da
// aba (addDemoParty em src/lib/demo-store.tsx), sem nome nem dados
// cadastrais: o app real pode consultá-los na JUDIT ao salvar.

export function AddPartyDialog({
  documentType,
  open,
  onOpenChange,
  defaultDocument,
}: {
  documentType: DocumentType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDocument?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {/* Montado só aberto: cada abertura começa do zero. */}
        {open && (
          <AddPartyForm
            documentType={documentType}
            defaultDocument={defaultDocument}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function AddPartyForm({
  documentType,
  defaultDocument,
  onDone,
}: {
  documentType: DocumentType;
  defaultDocument?: string;
  onDone: () => void;
}) {
  const router = useRouter();
  const { parties, addDemoParty } = useDemoStore();
  const info = DOCUMENTS[documentType];
  const isCompany = documentType === "cnpj";
  const [value, setValue] = useState(
    defaultDocument ? formatDocument(documentType, defaultDocument) : "",
  );
  const [error, setError] = useState<string | null>(null);

  const existing = parties.find(
    (p) =>
      p.documentType === documentType &&
      p.document === normalizeDocument(documentType, value),
  );

  function save() {
    const parsed = documentSchema(documentType).safeParse(value);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? `${info.label} inválido`);
      return;
    }

    const party = addDemoParty(documentType, parsed.data);
    onDone();
    toast.success(
      isCompany
        ? "Empresa adicionada (demonstração)"
        : "Pessoa adicionada (demonstração)",
      {
        description:
          "Fica só nesta aba e some ao recarregar. Nada foi consultado na JUDIT.",
      },
    );
    router.push(partyHref(party.documentType, party.document));
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
      className="flex flex-col gap-5"
      noValidate
    >
      <DialogHeader>
        <DialogTitle>
          Adicionar {isCompany ? "empresa" : "pessoa física"}
        </DialogTitle>
        <DialogDescription>
          Entra na sua lista sem criar um monitoramento. Depois, na página dela,
          você consulta os processos ou começa a monitorar.
        </DialogDescription>
      </DialogHeader>

      <Field data-invalid={!!error}>
        <FieldLabel htmlFor="party-document">{info.label}</FieldLabel>
        <Input
          id="party-document"
          autoFocus
          placeholder={info.placeholder}
          value={value}
          aria-invalid={!!error}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
        />
        {error ? (
          <FieldError>{error}</FieldError>
        ) : (
          <FieldDescription>
            {existing
              ? `Já está na lista: ${existing.name ?? "nome não consultado"}.`
              : isCompany
                ? "Aceita o CNPJ numérico e o alfanumérico."
                : "CPF com ou sem máscara."}
          </FieldDescription>
        )}
      </Field>

      <Alert>
        <InfoIcon />
        <AlertDescription>
          Demonstração: a parte fica só nesta aba, sem nome nem dados
          cadastrais, e some ao recarregar a página. Nada é consultado na JUDIT.
        </AlertDescription>
      </Alert>

      <DialogFooter>
        <Button type="submit">Adicionar à demonstração</Button>
      </DialogFooter>
    </form>
  );
}
