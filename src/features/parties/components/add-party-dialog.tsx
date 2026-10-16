"use client";

import { CloudDownloadIcon, InfoIcon } from "lucide-react";
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
import { Spinner } from "@/components/ui/spinner";
import { SERVER_UNREACHABLE, useDemoStore } from "@/lib/demo-store";

import { addPartyAction, type AddPartyResult } from "../actions";
import {
  documentSchema,
  DOCUMENTS,
  formatDocument,
  normalizeDocument,
  partyHref,
  type DocumentType,
} from "../documents";

// Adicionar uma empresa ou pessoa física à lista sem criar um monitoramento
// (círculos 1 e 2 do escopo). Dois caminhos, com o custo explícito:
//
//   Salvar sem consultar         grátis; a parte fica só com o documento
//   Consultar na JUDIT e salvar  cobrado; preenche nome e situação cadastral
//
// A validação do documento se repete no servidor (addPartyAction).

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
  const { parties } = useDemoStore();
  const info = DOCUMENTS[documentType];
  const isCompany = documentType === "cnpj";
  const [value, setValue] = useState(
    defaultDocument ? formatDocument(documentType, defaultDocument) : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"lookup" | "plain" | null>(null);

  const existing = parties.find(
    (p) =>
      p.documentType === documentType &&
      p.document === normalizeDocument(documentType, value),
  );

  async function save(lookup: boolean) {
    if (pending) return;
    const parsed = documentSchema(documentType).safeParse(value);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? `${info.label} inválido`);
      return;
    }

    setPending(lookup ? "lookup" : "plain");
    let result: AddPartyResult;
    try {
      result = await addPartyAction({
        documentType,
        document: parsed.data,
        lookup,
      });
    } catch {
      setPending(null);
      setError(SERVER_UNREACHABLE);
      return;
    }
    setPending(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }

    onDone();
    const label = isCompany ? "Empresa adicionada" : "Pessoa adicionada";
    const registration = result.registration;
    if (registration && !registration.found) {
      toast.warning(`${label} sem dados cadastrais`, {
        description: `A JUDIT não encontrou cadastro para este ${info.label}.`,
      });
    } else {
      toast.success(label, {
        description: registration
          ? (registration.name ?? "Cadastro encontrado, sem nome.")
          : "Os dados cadastrais podem ser consultados na página dela.",
      });
    }
    router.push(partyHref(result.party.documentType, result.party.document));
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void save(true);
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
                : "CPF é dado pessoal: use só com base legal para consultar."}
          </FieldDescription>
        )}
      </Field>

      <Alert>
        <InfoIcon />
        <AlertDescription>
          A consulta de dados cadastrais é cobrada por requisição e preenche o
          nome e a situação na Receita. Sem ela, a parte é salva só com o
          documento.
        </AlertDescription>
      </Alert>

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          disabled={!!pending}
          onClick={() => void save(false)}
        >
          {pending === "plain" && <Spinner data-icon="inline-start" />}
          Salvar sem consultar
        </Button>
        <Button type="submit" disabled={!!pending}>
          {pending === "lookup" ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <CloudDownloadIcon data-icon="inline-start" />
          )}
          Consultar na JUDIT e salvar
        </Button>
      </DialogFooter>
    </form>
  );
}
