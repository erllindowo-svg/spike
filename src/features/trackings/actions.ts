"use server";

import { refresh } from "next/cache";

import { getDataSource } from "@/lib/data";

import {
  createTracking,
  type CreateTrackingResult,
  type NewTrackingRequest,
} from "./db";

// Server Action: o navegador chama esta função, mas ela roda no servidor.
// Por baixo, é uma requisição POST que qualquer pessoa pode enviar
// diretamente, sem passar pelo formulário. Por isso ela não confia no
// cliente: confere o modo de dados e deixa createTracking validar a entrada.
//
// Ainda não há autenticação: no modo "db", quem alcança a aplicação pode
// gravar monitoramentos. Nada é enviado à JUDIT, então não há custo, mas a
// aplicação não deve ficar pública nesse modo.

export type CreateTrackingActionResult =
  CreateTrackingResult | { ok: false; reason: "unavailable" | "error" };

export async function createTrackingAction(
  input: NewTrackingRequest,
): Promise<CreateTrackingActionResult> {
  // No modo de demonstração, nada pode ser gravado no banco.
  if (getDataSource() !== "db") return { ok: false, reason: "unavailable" };

  try {
    const result = await createTracking(input);
    // Recarrega os dados do servidor no navegador (por exemplo, a empresa
    // criada junto com um monitoramento de CNPJ).
    if (result.ok) refresh();
    return result;
  } catch (error) {
    // A mensagem do driver pode conter o endereço do banco: fica só no log
    // do servidor. O identificador monitorado não é registrado.
    console.error(
      "[trackings] falha ao gravar monitoramento:",
      error instanceof Error ? error.message : error,
    );
    return { ok: false, reason: "error" };
  }
}
