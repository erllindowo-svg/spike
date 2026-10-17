import type {
  DocumentType,
  LawsuitStats,
  SearchType,
  StoredLawsuit,
  StoredRegistration,
  StoredWarrant,
} from "@/db/models";
import { identify } from "@/features/consult/identify";
import type { SyntheticGroup } from "@/features/consult/results";
import { fromJuditLawsuit } from "@/features/processes/judit";
import { fromJuditEntity, type Entity } from "@/features/parties/registration";
import { summaryText, toWarrant } from "@/features/queries/responses";
import {
  lawsuitSchema,
  type Lawsuit as JuditLawsuit,
} from "@/lib/judit/schemas/lawsuits";

// De item da JUDIT para registro da base própria (decisão D1). Funções
// puras: não chamam a rede nem o banco (a gravação fica em db.ts).

type Fields<T> = Omit<
  T,
  "id" | "source" | "fetchedAt" | "firstSeenAt" | "juditData"
>;

// O registro a gravar, com a chave do item e o lado do assunto pesquisado.
export type LawsuitRecord = {
  kind: "lawsuit";
  itemKey: string;
  fields: Fields<StoredLawsuit>;
  juditData: unknown;
  role: "active" | "passive" | "interested" | null;
};
export type RegistrationRecord = {
  kind: "registration";
  itemKey: string;
  fields: Fields<StoredRegistration>;
  juditData: unknown;
  role: null;
};
export type WarrantRecord = {
  kind: "warrant";
  itemKey: string;
  fields: Fields<StoredWarrant>;
  juditData: unknown;
  role: null;
};
export type BaseRecord = LawsuitRecord | RegistrationRecord | WarrantRecord;

export type StatsRecord = {
  mode: LawsuitStats["mode"];
  total: number | null;
  groups: SyntheticGroup[];
  juditData: unknown;
};

// O que se aprendeu numa resposta: os itens e, na consulta processual
// completa, o resumo por IA.
export type BaseBatch = {
  records: BaseRecord[];
  aiSummary: string | null;
};

// Um processo (ou execução penal, que tem o mesmo formato). `subject` é o
// que foi pesquisado: com CPF ou CNPJ, o lado do documento no processo
// vem junto.
export function lawsuitRecord(
  item: JuditLawsuit,
  kind: "lawsuit" | "execution",
  subject: { searchType: SearchType; searchKey: string },
): LawsuitRecord {
  const party =
    subject.searchType === "cpf" || subject.searchType === "cnpj"
      ? { id: "", document: subject.searchKey }
      : null;
  const view = fromJuditLawsuit(item, party);
  const instance = typeof item.instance === "number" ? item.instance : 1;
  return {
    kind: "lawsuit",
    itemKey: `${view.cnj}:${instance}`,
    role: view.partyRole,
    juditData: item,
    fields: {
      cnj: view.cnj,
      instance,
      kind,
      tribunal: view.tribunal === "Não informado" ? null : view.tribunal,
      area: view.area,
      className: view.className,
      subject: view.subject,
      judgingBody: view.judgingBody,
      status: view.status,
      distributedAt: view.distributedAt,
      lastMovementAt: view.lastMovementAt,
      amount: view.amount,
      secrecyLevel:
        typeof item.secrecy_level === "number" ? item.secrecy_level : null,
      // Só a gravação decide se troca o resumo (db.ts).
      aiSummary: null,
    },
  };
}

// Cadastros de POST /entities. A chave é o documento do próprio cadastro
// (`main_document`): numa busca por nome, a lista pode trazer várias
// pessoas, cada uma com o seu. Um cadastro sem documento reconhecível não
// tem chave e não é gravado.
export function registrationRecords(entities: Entity[]): RegistrationRecord[] {
  return entities.flatMap((entity) => {
    const document = documentOf(entity.main_document);
    if (!document) return [];
    const data = fromJuditEntity(entity);
    return [
      {
        kind: "registration" as const,
        itemKey: `${document.type}:${document.key}`,
        role: null,
        juditData: entity,
        fields: {
          documentType: document.type,
          document: document.key,
          name: data.name,
          tradeName: data.tradeName,
          registrationStatus: data.registrationStatus,
          specialStatus: data.specialStatus,
        },
      },
    ];
  });
}

function documentOf(
  value: unknown,
): { type: DocumentType; key: string } | null {
  if (typeof value !== "string") return null;
  const result = identify(value);
  if (result.status !== "recognized") return null;
  const first = result.candidates[0];
  return first.type === "cpf" || first.type === "cnpj"
    ? { type: first.type, key: first.key }
    : null;
}

export function warrantRecord(data: unknown): WarrantRecord | null {
  const view = toWarrant(data);
  const key = view?.code ?? view?.number;
  if (!view || !key) return null;
  return {
    kind: "warrant",
    itemKey: key,
    role: null,
    juditData: data,
    fields: { key, ...view },
  };
}

// Itens de GET /responses (consulta assíncrona ou monitoramento) ou de uma
// entrega de webhook: processos, execuções, mandados e o resumo por IA. O
// resto (application_error, application_info) não é dado para a base.
export function batchFromResponses(
  items: { response_type?: string; response_data?: unknown }[],
  subject: { searchType: SearchType; searchKey: string },
): BaseBatch {
  const batch: BaseBatch = { records: [], aiSummary: null };
  for (const item of items) {
    const type = item.response_type;
    if (type === "lawsuit" || type === "execution") {
      const parsed = lawsuitSchema.safeParse(item.response_data);
      if (parsed.success) {
        batch.records.push(
          lawsuitRecord(
            parsed.data,
            type === "execution" ? "execution" : "lawsuit",
            subject,
          ),
        );
      }
    } else if (type === "warrant") {
      const record = warrantRecord(item.response_data);
      if (record) batch.records.push(record);
    } else if (type === "summary") {
      batch.aiSummary = summaryText(item.response_data) ?? batch.aiSummary;
    }
  }
  return batch;
}
