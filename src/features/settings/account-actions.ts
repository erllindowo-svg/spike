"use server";

import { juditActionFailure } from "@/features/queries/failure";
import { getDataSource } from "@/lib/data";
import {
  getBillingConsumption,
  getCreditBalance,
  type BillingConsumption,
} from "@/lib/judit/account";
import { JuditHttpError } from "@/lib/judit/errors";

// Server Action do cartão "Conta na JUDIT" (Configurações): saldo de
// créditos e consumo do ciclo, lidos por clique (a documentação não diz se
// as leituras são cobradas). As duas são independentes: uma falha (por
// exemplo, a chave não ser administrativa) não esconde a outra.

type Part<T> = { ok: true; value: T } | { ok: false; message: string };

export type AccountResult =
  | {
      ok: true;
      // Campos simples da resposta, como vieram: o formato não é
      // documentado (README da integração, item 45).
      balance: Part<[string, string][]>;
      consumption: Part<BillingConsumption>;
    }
  | { ok: false; message: string };

export async function readJuditAccountAction(): Promise<AccountResult> {
  if (getDataSource() !== "db") {
    return { ok: false, message: "A demonstração não chama a JUDIT." };
  }
  const [balance, consumption] = await Promise.allSettled([
    getCreditBalance(),
    getBillingConsumption(),
  ]);
  return {
    ok: true,
    balance:
      balance.status === "fulfilled"
        ? { ok: true, value: simpleFields(balance.value) }
        : { ok: false, message: accountError(balance.reason) },
    consumption:
      consumption.status === "fulfilled"
        ? { ok: true, value: consumption.value }
        : { ok: false, message: accountError(consumption.reason) },
  };
}

function simpleFields(value: Record<string, unknown>): [string, string][] {
  return Object.entries(value)
    .filter(
      ([, field]) =>
        typeof field === "string" ||
        typeof field === "number" ||
        typeof field === "boolean",
    )
    .slice(0, 12)
    .map(([key, field]) => [key, String(field)]);
}

function accountError(error: unknown): string {
  if (
    error instanceof JuditHttpError &&
    (error.status === 401 || error.status === 403)
  ) {
    return "Sem permissão: esta leitura exige uma chave administrativa da conta.";
  }
  return juditActionFailure(error, "account").message;
}
