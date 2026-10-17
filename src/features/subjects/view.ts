import type {
  LawsuitStats,
  RecordOrigin,
  StoredLawsuit,
  StoredRegistration,
} from "@/lib/models";
import type { Lawsuit } from "@/features/processes/types";

// O que a ficha de um assunto mostra. No app real, vem da base própria no
// MongoDB; no protótipo, dos processos fictícios (cadastros, mandados e
// números ficam vazios). Funções puras.

export type WarrantView = {
  code: string | null;
  number: string | null;
  warrantType: string | null;
  arrestType: string | null;
  status: string | null;
  issueDate: string | null;
  expirationDate: string | null;
  judgementSummary: string | null;
};

type Known = { fetchedAt: Date | null; origin: RecordOrigin | null };

export type SubjectLawsuit = Lawsuit &
  Known & {
    kind: StoredLawsuit["kind"];
    secrecyLevel: number | null;
    aiSummary: string | null;
  };

export type SubjectRegistration = Pick<
  StoredRegistration,
  | "documentType"
  | "document"
  | "name"
  | "tradeName"
  | "registrationStatus"
  | "specialStatus"
> &
  Known;

export type SubjectWarrant = WarrantView & Known;

export type SubjectStats = Pick<LawsuitStats, "mode" | "total" | "groups"> &
  Known;

export type SubjectView = {
  lawsuits: SubjectLawsuit[];
  registrations: SubjectRegistration[];
  warrants: SubjectWarrant[];
  stats: SubjectStats[];
};

export const EMPTY_SUBJECT_VIEW: SubjectView = {
  lawsuits: [],
  registrations: [],
  warrants: [],
  stats: [],
};

// Os processos fictícios, sem data de consulta.
export function demoSubjectView(lawsuits: Lawsuit[]): SubjectView {
  return {
    ...EMPTY_SUBJECT_VIEW,
    lawsuits: lawsuits.map((l) => ({
      ...l,
      kind: "lawsuit",
      secrecyLevel: null,
      aiSummary: null,
      fetchedAt: null,
      origin: null,
    })),
  };
}
