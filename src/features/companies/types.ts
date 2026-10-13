import type { Company } from "@/db/models";

export type { Company };

// Valores livres da Receita Federal; a interface só destaca os conhecidos.
export function getRegistrationStatusTone(
  status: string | null,
): "success" | "warning" | "neutral" {
  if (!status) return "neutral";
  return status.toLowerCase() === "ativa" ? "success" : "warning";
}
