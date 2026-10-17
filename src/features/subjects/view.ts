import type {
  LawsuitStats,
  RecordOrigin,
  StoredLawsuit,
  StoredRegistration,
  StoredWarrant,
} from "@/db/models";
import type { SubjectRecords } from "@/features/base/db";
import type { Lawsuit } from "@/features/processes/types";
import type { WarrantView } from "@/features/queries/responses";

// O que a ficha de um assunto mostra da base própria, sem o `juditData`
// (o item inteiro fica no banco; a tela não precisa dele e ele pode ser
// grande). Funções puras.

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

function known(record: { fetchedAt: Date; source: { origin: RecordOrigin } }) {
  return { fetchedAt: record.fetchedAt, origin: record.source.origin };
}

export function toSubjectView(records: SubjectRecords): SubjectView {
  return {
    lawsuits: records.lawsuits.map((l) => ({
      id: `${l.cnj}-${l.instance}`,
      cnj: l.cnj,
      partyId: null,
      tribunal: l.tribunal ?? "Não informado",
      area: l.area,
      className: l.className,
      subject: l.subject,
      judgingBody: l.judgingBody,
      partyRole: l.role,
      status: l.status,
      distributedAt: l.distributedAt,
      lastMovementAt: l.lastMovementAt,
      amount: l.amount,
      movements: [],
      kind: l.kind,
      secrecyLevel: l.secrecyLevel,
      aiSummary: l.aiSummary ?? null,
      ...known(l),
    })),
    registrations: records.registrations.map((r) => ({
      documentType: r.documentType,
      document: r.document,
      name: r.name,
      tradeName: r.tradeName,
      registrationStatus: r.registrationStatus,
      specialStatus: r.specialStatus,
      ...known(r),
    })),
    warrants: records.warrants.map((w: StoredWarrant) => ({
      code: w.code,
      number: w.number,
      warrantType: w.warrantType,
      arrestType: w.arrestType,
      status: w.status,
      issueDate: w.issueDate,
      expirationDate: w.expirationDate,
      judgementSummary: w.judgementSummary,
      ...known(w),
    })),
    stats: records.stats.map((s) => ({
      mode: s.mode,
      total: s.total,
      groups: s.groups,
      ...known(s),
    })),
  };
}
