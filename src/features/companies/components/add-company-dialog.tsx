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

import { addCompanyAction, type AddCompanyResult } from "../actions";
import { cnpjSchema, formatCnpj, normalizeCnpj } from "../cnpj";

// Adicionar uma empresa à lista sem criar um monitoramento (círculo 1 do
// escopo, C1-6). Dois caminhos, com o custo explícito:
//
//   Salvar sem consultar         grátis; a empresa fica só com o CNPJ
//   Consultar na JUDIT e salvar  cobrado; preenche razão social e situação
//
// A validação do CNPJ se repete no servidor (addCompanyAction).

export function AddCompanyDialog({
  open,
  onOpenChange,
  defaultCnpj,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCnpj?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {/* A key zera o formulário a cada abertura. */}
        {open && (
          <AddCompanyForm
            key={defaultCnpj ?? ""}
            defaultCnpj={defaultCnpj}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function AddCompanyForm({
  defaultCnpj,
  onDone,
}: {
  defaultCnpj?: string;
  onDone: () => void;
}) {
  const router = useRouter();
  const { companies } = useDemoStore();
  const [value, setValue] = useState(
    defaultCnpj ? formatCnpj(defaultCnpj) : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"lookup" | "plain" | null>(null);

  const existing = companies.find((c) => c.cnpj === normalizeCnpj(value));

  async function save(lookup: boolean) {
    if (pending) return;
    const parsed = cnpjSchema.safeParse(value);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "CNPJ inválido");
      return;
    }

    setPending(lookup ? "lookup" : "plain");
    let result: AddCompanyResult;
    try {
      result = await addCompanyAction({ cnpj: parsed.data, lookup });
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
    const registration = result.registration;
    if (registration && !registration.found) {
      toast.warning("Empresa adicionada sem dados cadastrais", {
        description: "A JUDIT não encontrou cadastro para este CNPJ.",
      });
    } else {
      toast.success("Empresa adicionada", {
        description: registration
          ? (registration.legalName ?? "Cadastro encontrado, sem razão social.")
          : "Os dados cadastrais podem ser consultados na página da empresa.",
      });
    }
    router.push(`/empresas/${result.cnpj}`);
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
        <DialogTitle>Adicionar empresa</DialogTitle>
        <DialogDescription>
          A empresa entra na sua lista sem criar um monitoramento. Depois, na
          página dela, você consulta os processos ou começa a monitorar.
        </DialogDescription>
      </DialogHeader>

      <Field data-invalid={!!error}>
        <FieldLabel htmlFor="company-cnpj">CNPJ</FieldLabel>
        <Input
          id="company-cnpj"
          autoFocus
          placeholder="00.000.000/0000-00"
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
              ? `Já está na lista: ${existing.legalName ?? "razão social não consultada"}.`
              : "Aceita o CNPJ numérico e o alfanumérico."}
          </FieldDescription>
        )}
      </Field>

      <Alert>
        <InfoIcon />
        <AlertDescription>
          A consulta de dados cadastrais é cobrada por requisição e preenche a
          razão social e a situação na Receita. Sem ela, a empresa é salva só
          com o CNPJ.
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
