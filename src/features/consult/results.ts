import type { DistributionDatum } from "@/features/processes/types";
import type { Lawsuit } from "@/features/processes/types";
import type { RegistrationData } from "@/features/parties/registration";

// O que cada consulta avulsa devolve à tela (no protótipo, montado com os
// dados fictícios).

export type SyntheticGroup = {
  title: string;
  data: DistributionDatum[];
};

export type ConsultPayload =
  | { kind: "count"; total: number }
  | { kind: "synthetic"; total: number | null; groups: SyntheticGroup[] }
  | { kind: "lawsuits"; lawsuits: Lawsuit[]; total: number }
  | { kind: "registration"; registration: RegistrationData }
  | { kind: "lawsuit"; lawsuits: Lawsuit[] }
  | { kind: "async"; requestId: string };
