// Dados fictícios de demonstração. Empresas, CNPJs, processos e eventos foram
// inventados e não refletem consultas reais à JUDIT nem pessoas ou empresas reais.

import type { ActivityItem } from "@/features/activity/types";
import type { AlertView } from "@/features/alerts/types";
import type { Party } from "@/features/parties/types";
import { computeCnjCheckDigits } from "@/features/processes/cnj";
import type {
  PartyRole,
  Lawsuit,
  LawsuitMovement,
  LawsuitStatus,
} from "@/features/processes/types";
import { trackingModeFor } from "@/features/queries/modes";
import type { QueryView } from "@/features/queries/types";
import type { Tracking } from "@/features/trackings/types";
import type { WebhookEventView } from "@/features/webhooks/types";

// Referência fixa de "agora" para que os mocks sejam determinísticos.
export const DEMO_NOW = new Date("2026-10-10T18:00:00-03:00");

const at = (iso: string) => new Date(`${iso}-03:00`);
const mockId = (prefix: number, n: number) =>
  `00000000-0000-4000-8${String(prefix).padStart(3, "0")}-${String(n).padStart(12, "0")}`;

// Partes: empresas (CNPJ) e pessoas físicas (CPF)

type CompanyKey =
  | "aurora"
  | "bravo"
  | "cedro"
  | "delta"
  | "estrela"
  | "farol"
  | "semNome"
  | "ipe";

const companyRows: [
  CompanyKey,
  string,
  string | null,
  string | null,
  string,
][] = [
  [
    "aurora",
    "10101010000177",
    "Aurora Logística Integrada Ltda.",
    "Ativa",
    "2026-07-02T09:10",
  ],
  [
    "bravo",
    "20202020000152",
    "Bravo Engenharia e Construções S.A.",
    "Ativa",
    "2026-07-15T14:22",
  ],
  [
    "cedro",
    "30303030000138",
    "Cedro Alimentos do Brasil Ltda.",
    "Ativa",
    "2026-08-03T10:05",
  ],
  [
    "delta",
    "40404040000113",
    "Delta Serviços Financeiros S.A.",
    "Ativa",
    "2026-08-20T16:40",
  ],
  [
    "estrela",
    "50505050000107",
    "Estrela Têxtil Ltda.",
    "Baixada",
    "2026-09-01T11:30",
  ],
  [
    "farol",
    "60606060000184",
    "Farol Tecnologia Ltda.",
    null,
    "2026-09-18T08:55",
  ],
  ["semNome", "70707070001050", null, null, "2026-10-02T17:12"],
  [
    "ipe",
    "12ABC345000188",
    "Ipê Comércio Digital Ltda.",
    "Ativa",
    "2026-10-06T13:48",
  ],
];

// CPFs com dígitos verificadores válidos, mas evidentemente fictícios
// (começam com zeros); nomes inventados.
type PersonKey = "joana" | "carlos";

const personRows: [PersonKey, string, string, string][] = [
  ["joana", "00000000191", "Joana Exemplo Souza", "2026-09-10T15:20"],
  ["carlos", "00000000272", "Carlos Fictício Lima", "2026-10-04T09:45"],
];

const companyParties: Party[] = companyRows.map(
  ([, document, name, registrationStatus, createdAt], index) => ({
    id: mockId(1, index + 1),
    documentType: "cnpj",
    document,
    name,
    registrationStatus,
    createdAt: at(createdAt),
    updatedAt: at("2026-10-09T08:00"),
  }),
);

const personParties: Party[] = personRows.map(
  ([, document, name, createdAt], index) => ({
    id: mockId(9, index + 1),
    documentType: "cpf",
    document,
    name,
    registrationStatus: "Regular",
    createdAt: at(createdAt),
    updatedAt: at("2026-10-09T08:00"),
  }),
);

export const parties: Party[] = [...companyParties, ...personParties];

const partyId = (key: CompanyKey | PersonKey) => {
  const companyIndex = companyRows.findIndex(([k]) => k === key);
  if (companyIndex >= 0) return companyParties[companyIndex].id;
  return personParties[personRows.findIndex(([k]) => k === key)].id;
};

// Processos

type PartyKey = CompanyKey | PersonKey;

type LawsuitRow = {
  company: PartyKey | null;
  seq: string;
  year: number;
  court: "8.26" | "8.19" | "8.13" | "8.16" | "5.02" | "5.15" | "4.03" | "4.04";
  origin: string;
  area: string | null;
  className: string | null;
  subject: string | null;
  role: PartyRole | null;
  status: LawsuitStatus | null;
  distributed: string | null;
  lastMovement: string | null;
  amount: number | null;
};

const tribunalByCourt: Record<LawsuitRow["court"], string> = {
  "8.26": "TJSP",
  "8.19": "TJRJ",
  "8.13": "TJMG",
  "8.16": "TJPR",
  "5.02": "TRT-2",
  "5.15": "TRT-15",
  "4.03": "TRF-3",
  "4.04": "TRF-4",
};

const judgingBodyByCourt: Record<LawsuitRow["court"], string> = {
  "8.26": "Vara Cível",
  "8.19": "Vara Cível",
  "8.13": "Vara Cível",
  "8.16": "Vara da Fazenda Pública",
  "5.02": "Vara do Trabalho",
  "5.15": "Vara do Trabalho",
  "4.03": "Vara Federal",
  "4.04": "Vara Federal",
};

const L = (
  company: PartyKey | null,
  seq: string,
  year: number,
  court: LawsuitRow["court"],
  origin: string,
  area: string | null,
  className: string | null,
  subject: string | null,
  role: PartyRole | null,
  status: LawsuitStatus | null,
  distributed: string | null,
  lastMovement: string | null,
  amount: number | null,
): LawsuitRow => ({
  company,
  seq,
  year,
  court,
  origin,
  area,
  className,
  subject,
  role,
  status,
  distributed,
  lastMovement,
  amount,
});

// prettier-ignore
const lawsuitRows: LawsuitRow[] = [
  L("aurora", "1004512", 2025, "8.26", "0100", "Cível", "Procedimento Comum Cível", "Inadimplemento", "active", "active", "2025-03-12", "2026-10-09T15:20", 184500),
  L("aurora", "1017733", 2024, "8.26", "0224", "Consumidor", "Procedimento do Juizado Especial Cível", "Indenização por dano material", "passive", "active", "2024-11-04", "2026-10-07T11:02", 18200),
  L("aurora", "1000871", 2026, "5.02", "0061", "Trabalhista", "Ação Trabalhista - Rito Ordinário", "Horas extras", "passive", "active", "2026-02-18", "2026-10-08T09:45", 96000),
  L("aurora", "1002210", 2025, "5.02", "0012", "Trabalhista", "Ação Trabalhista - Rito Sumaríssimo", "Verbas rescisórias", "passive", "archived", "2025-01-21", "2026-06-30T10:00", 32000),
  L("aurora", "5003318", 2024, "4.03", "6100", "Tributário", "Execução Fiscal", "Dívida ativa", "passive", "suspended", "2024-05-08", "2026-05-14T16:20", 412300),
  L("aurora", "1009904", 2026, "8.19", "0001", "Cível", "Monitória", "Duplicata", "active", "active", "2026-04-02", "2026-09-29T13:10", 58750),
  L("aurora", "1012045", 2026, "8.26", "0100", "Cível", "Procedimento Comum Cível", null, "passive", "active", "2026-10-06", "2026-10-06T08:12", null),
  L("aurora", "1013310", 2026, "8.26", "0100", "Cível", "Procedimento Comum Cível", "Cobrança", "passive", "active", "2026-10-09", "2026-10-09T16:00", 47300),
  L("aurora", "1003387", 2023, "8.13", "0024", "Consumidor", "Procedimento Comum Cível", "Indenização por dano moral", "passive", "archived", "2023-08-15", "2025-12-01T15:00", 25000),
  L("aurora", "5011120", 2025, "4.03", "6100", "Tributário", "Mandado de Segurança Cível", "Contribuições previdenciárias", "active", "active", "2025-09-10", "2026-09-22T17:40", null),
  L("bravo", "1020336", 2024, "8.26", "0053", "Cível", "Procedimento Comum Cível", "Rescisão contratual", "active", "active", "2024-06-19", "2026-10-03T14:05", 920000),
  L("bravo", "1001458", 2025, "5.15", "0032", "Trabalhista", "Ação Trabalhista - Rito Ordinário", "Acidente de trabalho", "passive", "active", "2025-02-27", "2026-10-09T10:30", 240000),
  L("bravo", "1001902", 2025, "5.15", "0032", "Trabalhista", "Ação Trabalhista - Rito Ordinário", "Adicional de insalubridade", "passive", "active", "2025-04-11", "2026-09-16T09:00", 75000),
  L("bravo", "6002741", 2023, "8.16", "0004", "Administrativo", "Procedimento Comum Cível", "Licitações", "active", "active", "2023-10-02", "2026-08-28T16:45", 1350000),
  L("bravo", "1005519", 2024, "8.26", "0100", "Ambiental", "Ação Civil Pública", "Dano ambiental", "passive", "active", "2024-09-23", "2026-09-30T11:15", null),
  L("bravo", "1000064", 2022, "8.26", "0053", "Cível", "Execução de Título Extrajudicial", "Contratos", "active", "archived", "2022-03-08", "2025-07-18T12:00", 310000),
  L("bravo", "1007781", 2026, "5.02", "0081", "Trabalhista", null, null, "passive", null, null, null, null),
  L("cedro", "1014420", 2025, "8.13", "0702", "Consumidor", "Procedimento do Juizado Especial Cível", "Vício do produto", "passive", "active", "2025-11-12", "2026-10-01T15:30", 9800),
  L("cedro", "1014987", 2025, "8.13", "0702", "Consumidor", "Procedimento do Juizado Especial Cível", "Vício do produto", "passive", "active", "2025-11-19", "2026-09-24T10:10", 7400),
  L("cedro", "1003365", 2026, "5.15", "0109", "Trabalhista", "Ação Trabalhista - Rito Ordinário", "Horas extras", "passive", "active", "2026-03-05", "2026-10-02T13:20", 61000),
  L("cedro", "5008812", 2025, "4.04", "7000", "Tributário", "Execução Fiscal", "Dívida ativa", "passive", "active", "2025-06-30", "2026-09-05T09:50", 128400),
  L("cedro", "1022180", 2024, "8.26", "0100", "Cível", "Procedimento Comum Cível", "Propriedade industrial", "active", "active", "2024-12-09", "2026-08-11T14:00", 200000),
  L("cedro", "1000932", 2023, "8.13", "0024", "Consumidor", "Procedimento Comum Cível", "Indenização por dano moral", "passive", "archived", "2023-02-14", "2024-11-20T11:00", 15000),
  L("delta", "1031176", 2025, "8.19", "0001", "Consumidor", "Procedimento Comum Cível", "Contratos bancários", "passive", "active", "2025-05-15", "2026-10-08T16:05", 42000),
  L("delta", "1031992", 2025, "8.19", "0001", "Consumidor", "Procedimento do Juizado Especial Cível", "Cobrança indevida", "passive", "active", "2025-07-01", "2026-09-27T12:35", 6300),
  L("delta", "1008840", 2024, "8.26", "0100", "Cível", "Execução de Título Extrajudicial", "Cédula de crédito bancário", "active", "suspended", "2024-03-20", "2026-04-02T10:00", 560000),
  L("delta", "1004471", 2026, "5.02", "0040", "Trabalhista", "Ação Trabalhista - Rito Ordinário", "Equiparação salarial", "passive", "active", "2026-01-22", "2026-09-18T15:45", 88000),
  L("estrela", "1002650", 2021, "5.15", "0067", "Trabalhista", "Ação Trabalhista - Rito Ordinário", "Verbas rescisórias", "passive", "archived", "2021-09-13", "2024-02-08T10:00", 54000),
  L("estrela", "5000417", 2022, "4.03", "6182", "Tributário", "Execução Fiscal", "Dívida ativa", "passive", "active", "2022-04-19", "2026-07-21T14:30", 97500),
  L("estrela", "1009983", 2023, "8.26", "0477", "Cível", "Falência de Empresários, Sociedades Empresárias, Microempresas e Empresas de Pequeno Porte", null, "passive", "active", "2023-05-29", "2026-09-09T09:20", null),
  L("semNome", "1001276", 2026, "8.26", "0100", null, null, null, null, null, "2026-09-12", null, null),
  L("semNome", "1001811", 2026, "5.02", "0012", "Trabalhista", null, null, "passive", "active", "2026-09-30", "2026-10-05T11:00", null),
  L("ipe", "1010044", 2026, "8.16", "0014", "Consumidor", "Procedimento do Juizado Especial Cível", "Entrega de mercadoria", "passive", "active", "2026-08-25", "2026-10-04T15:10", 3900),
  L(null, "0718455", 2024, "8.26", "0100", "Cível", "Procedimento Comum Cível", "Contratos", null, "active", "2024-10-01", "2026-10-08T17:30", 75000),
  // Pessoas físicas fictícias.
  L("joana", "1012345", 2025, "8.26", "0100", "Família", "Divórcio Consensual", "Dissolução", "active", "archived", "2025-02-10", "2025-08-21T14:00", null),
  L("joana", "1023456", 2026, "8.19", "0001", "Consumidor", "Procedimento do Juizado Especial Cível", "Cobrança indevida", "active", "active", "2026-05-06", "2026-10-03T10:30", 7400),
  L("carlos", "1034567", 2024, "5.15", "0010", "Trabalhista", "Ação Trabalhista - Rito Ordinário", "Vínculo empregatício", "active", "active", "2024-09-12", "2026-09-30T16:05", 45000),
];

const movementTemplates = [
  "Petição inicial distribuída",
  "Conclusos para despacho",
  "Despacho proferido: cite-se a parte requerida",
  "Juntada de mandado de citação cumprido",
  "Juntada de contestação",
  "Audiência de conciliação designada",
  "Juntada de petição intermediária",
  "Decisão interlocutória publicada",
  "Remessa ao contador judicial",
  "Intimação expedida às partes",
];

function buildMovements(
  row: LawsuitRow,
  lawsuitIndex: number,
): LawsuitMovement[] {
  if (!row.distributed || !row.lastMovement) return [];
  const start = at(`${row.distributed}T09:00`).getTime();
  const end = at(row.lastMovement).getTime();
  const count = 3 + (lawsuitIndex % 4);
  const movements: LawsuitMovement[] = [];
  for (let i = 0; i < count; i++) {
    const ratio = count === 1 ? 1 : i / (count - 1);
    const description =
      i === 0
        ? movementTemplates[0]
        : i === count - 1 && row.status === "archived"
          ? "Arquivamento definitivo"
          : movementTemplates[
              1 + ((lawsuitIndex + i) % (movementTemplates.length - 1))
            ];
    movements.push({
      id: `${lawsuitIndex}-${i}`,
      occurredAt: new Date(start + (end - start) * ratio),
      description,
    });
  }
  return movements.reverse();
}

export const lawsuits: Lawsuit[] = lawsuitRows.map((row, index) => {
  const rest = `${row.year}${row.court.replace(".", "")}${row.origin}`;
  const checkDigits = computeCnjCheckDigits(row.seq, rest);
  return {
    id: mockId(2, index + 1),
    cnj: `${row.seq}${checkDigits}${rest}`,
    partyId: row.company ? partyId(row.company) : null,
    tribunal: tribunalByCourt[row.court],
    area: row.area,
    className: row.className,
    subject: row.subject,
    judgingBody: row.className ? judgingBodyByCourt[row.court] : null,
    partyRole: row.role,
    status: row.status,
    distributedAt: row.distributed ? at(`${row.distributed}T09:00`) : null,
    lastMovementAt: row.lastMovement ? at(row.lastMovement) : null,
    amount: row.amount,
    movements: buildMovements(row, index),
  };
});

const cnjOf = (seq: string) =>
  lawsuits[lawsuitRows.findIndex((r) => r.seq === seq)].cnj;

// Monitoramentos (status técnicos, como documentados pela JUDIT)

const T = (
  n: number,
  searchType: Tracking["searchType"],
  searchKey: string,
  company: PartyKey | null,
  status: string,
  recurrenceDays: number,
  createdAt: string,
  updatedAt: string,
): Tracking => ({
  id: mockId(3, n),
  juditTrackingId: `f3a1c2d4-0000-4000-9000-${String(n).padStart(12, "0")}`,
  partyId: company ? partyId(company) : null,
  mode: trackingModeFor(searchType),
  searchType,
  searchKey,
  creation: "confirmed",
  creationError: null,
  status,
  recurrenceDays,
  hourRange: null,
  // A demonstração simula a entrega por webhook.
  delivery: "webhook",
  stepTerms: null,
  createdAt: at(createdAt),
  updatedAt: at(updatedAt),
  lastCheckedAt: null,
});

export const trackings: Tracking[] = [
  T(
    1,
    "cnpj",
    "10101010000177",
    "aurora",
    "updated",
    1,
    "2026-07-02T09:20",
    "2026-10-10T07:05",
  ),
  T(
    2,
    "cnj",
    cnjOf("1004512"),
    "aurora",
    "updated",
    1,
    "2026-07-03T11:00",
    "2026-10-09T15:24",
  ),
  T(
    3,
    "cnpj",
    "20202020000152",
    "bravo",
    "updated",
    7,
    "2026-07-15T14:30",
    "2026-10-09T10:34",
  ),
  T(
    4,
    "cnj",
    cnjOf("1001458"),
    "bravo",
    "updating",
    1,
    "2026-08-01T10:15",
    "2026-10-10T06:58",
  ),
  T(
    5,
    "cnpj",
    "30303030000138",
    "cedro",
    "created",
    1,
    "2026-10-09T16:40",
    "2026-10-09T16:40",
  ),
  T(
    6,
    "cnj",
    cnjOf("1008840"),
    "delta",
    "paused",
    30,
    "2026-08-21T09:00",
    "2026-09-15T12:00",
  ),
  T(
    7,
    "cnj",
    cnjOf("1002650"),
    "estrela",
    "deleted",
    7,
    "2026-09-01T11:45",
    "2026-09-20T08:00",
  ),
  T(
    8,
    "cnpj",
    "70707070001050",
    "semNome",
    "suspended",
    1,
    "2026-10-02T17:20",
    "2026-10-07T03:10",
  ),
  T(
    9,
    "cnj",
    cnjOf("0718455"),
    null,
    "updated",
    1,
    "2026-09-10T08:30",
    "2026-10-08T17:35",
  ),
  T(
    10,
    "cpf",
    "00000000272",
    "carlos",
    "updated",
    7,
    "2026-10-04T10:00",
    "2026-10-09T06:12",
  ),
];

const trackingRef = (n: number) => trackings[n - 1].juditTrackingId;

// Eventos de webhook (envelope conforme docs.judit.io/webhook/callbacks;
// conteúdo de payload resumido e fictício)

type EventSeed = {
  n: number;
  eventType: string | null;
  referenceType: string | null;
  referenceId: string | null;
  receivedAt: string;
  status: WebhookEventView["processingStatus"];
  durationMs: number | null;
  error?: string;
  duplicateDeliveries?: number;
  alertIds?: string[];
  responseData?: Record<string, unknown>;
  omitCallbackId?: boolean;
};

const lawsuitPayload = (seq: string, step?: string) => {
  const lawsuit = lawsuits[lawsuitRows.findIndex((r) => r.seq === seq)];
  return {
    response_type: "lawsuit",
    response_data: {
      code: lawsuit.cnj.replace(
        /^(\d{7})(\d{2})(\d{4})(\d)(\d{2})(\d{4})$/,
        "$1-$2.$3.$4.$5.$6",
      ),
      tribunal_acronym: lawsuit.tribunal,
      instance: 1,
      ...(step && { last_step: { content: step } }),
    },
  };
};

function buildEvent(seed: EventSeed): WebhookEventView {
  const receivedAt = at(seed.receivedAt);
  const callbackId = seed.omitCallbackId
    ? null
    : `c0ffee00-0000-4000-a000-${String(seed.n).padStart(12, "0")}`;
  return {
    id: mockId(4, seed.n),
    callbackId,
    eventType: seed.eventType,
    referenceType: seed.referenceType,
    referenceId: seed.referenceId,
    payload: {
      user_id: "00000000-0000-4000-8000-0000000000de",
      ...(callbackId && { callback_id: callbackId }),
      ...(seed.eventType && { event_type: seed.eventType }),
      ...(seed.referenceType && { reference_type: seed.referenceType }),
      ...(seed.referenceId && { reference_id: seed.referenceId }),
      payload: {
        request_id: `5eed0000-0000-4000-b000-${String(seed.n).padStart(12, "0")}`,
        ...seed.responseData,
      },
    },
    receivedAt,
    processingStatus: seed.status,
    processingStartedAt: seed.status === "pending" ? null : receivedAt,
    processedAt:
      seed.durationMs === null
        ? null
        : new Date(receivedAt.getTime() + seed.durationMs),
    processingNote: null,
    processingError: seed.error ?? null,
    duplicateDeliveries: seed.duplicateDeliveries ?? 0,
    alertIds: seed.alertIds ?? [],
  };
}

const alertId = (n: number) => mockId(5, n);

export const webhookEvents: WebhookEventView[] = [
  buildEvent({
    n: 1,
    eventType: "response_created",
    referenceType: "tracking",
    referenceId: trackingRef(1),
    receivedAt: "2026-10-10T07:05:12",
    status: "processed",
    durationMs: 412,
    alertIds: [alertId(1)],
    responseData: lawsuitPayload("1013310"),
  }),
  buildEvent({
    n: 2,
    eventType: "response_created",
    referenceType: "tracking",
    referenceId: trackingRef(4),
    receivedAt: "2026-10-10T06:58:40",
    status: "pending",
    durationMs: null,
    responseData: lawsuitPayload("1001458", "Audiência de instrução designada"),
  }),
  buildEvent({
    n: 3,
    eventType: "response_created",
    referenceType: "tracking",
    referenceId: trackingRef(2),
    receivedAt: "2026-10-09T15:24:03",
    status: "processed",
    durationMs: 388,
    duplicateDeliveries: 2,
    alertIds: [alertId(2)],
    responseData: lawsuitPayload("1004512", "Juntada de petição intermediária"),
  }),
  buildEvent({
    n: 4,
    eventType: "response_created",
    referenceType: "tracking",
    referenceId: trackingRef(3),
    receivedAt: "2026-10-09T10:34:51",
    status: "processed",
    durationMs: 527,
    alertIds: [alertId(3)],
    responseData: lawsuitPayload("1001458", "Juntada de laudo pericial"),
  }),
  buildEvent({
    n: 5,
    eventType: "response_created",
    referenceType: "tracking",
    referenceId: "9b7e1d22-0000-4000-9000-00000000ffff",
    receivedAt: "2026-10-08T22:13:09",
    status: "failed",
    durationMs: 96,
    error:
      "Referência desconhecida: nenhum monitoramento local corresponde ao reference_id recebido.",
    responseData: lawsuitPayload("1031176"),
  }),
  buildEvent({
    n: 6,
    eventType: "response_created",
    referenceType: "tracking",
    referenceId: trackingRef(9),
    receivedAt: "2026-10-08T17:35:27",
    status: "processed",
    durationMs: 301,
    alertIds: [alertId(4)],
    responseData: lawsuitPayload("0718455", "Decisão interlocutória publicada"),
  }),
  buildEvent({
    n: 7,
    eventType: "request_completed",
    referenceType: "request",
    referenceId: "5eed0000-0000-4000-b000-000000000099",
    receivedAt: "2026-10-08T09:02:44",
    status: "ignored",
    durationMs: 18,
    error: "Nenhum tratamento definido para este event_type nesta etapa.",
    responseData: { status: "completed" },
  }),
  buildEvent({
    n: 8,
    eventType: "response_created",
    referenceType: "tracking",
    referenceId: trackingRef(8),
    receivedAt: "2026-10-07T03:10:15",
    status: "failed",
    durationMs: 1204,
    error:
      "Payload sem response_data: não foi possível identificar o processo relacionado.",
    responseData: { response_type: "lawsuit" },
  }),
  buildEvent({
    n: 9,
    eventType: "response_created",
    referenceType: "tracking",
    referenceId: trackingRef(1),
    receivedAt: "2026-10-06T08:12:30",
    status: "processed",
    durationMs: 455,
    alertIds: [alertId(5)],
    responseData: lawsuitPayload("1012045"),
  }),
  buildEvent({
    n: 10,
    eventType: null,
    referenceType: null,
    referenceId: null,
    receivedAt: "2026-10-05T19:48:02",
    status: "failed",
    durationMs: 12,
    error:
      "Envelope sem event_type e reference_id; evento armazenado apenas para investigação.",
    omitCallbackId: true,
    responseData: {},
  }),
  buildEvent({
    n: 11,
    eventType: "response_created",
    referenceType: "tracking",
    referenceId: trackingRef(3),
    receivedAt: "2026-10-03T14:05:37",
    status: "processed",
    durationMs: 610,
    alertIds: [alertId(6)],
    responseData: lawsuitPayload("1020336", "Sentença publicada"),
  }),
  buildEvent({
    n: 12,
    eventType: "response_created",
    referenceType: "tracking",
    referenceId: trackingRef(7),
    receivedAt: "2026-09-20T08:00:10",
    status: "processed",
    durationMs: 350,
    responseData: lawsuitPayload("1002650", "Arquivamento definitivo"),
  }),
];

// Alertas

// Como no processamento real (src/features/webhooks/process.ts), todo
// alerta vem de um monitoramento: a movimentação, do monitoramento do
// processo; o resto, do monitoramento por documento da parte.
function demoTrackingFor(
  company: CompanyKey | null,
  lawsuitCnj: string | null,
  type: AlertView["type"],
): string | null {
  const byLawsuit =
    type === "lawsuit_movement" && lawsuitCnj
      ? trackings.find(
          (t) => t.searchType === "cnj" && t.searchKey === lawsuitCnj,
        )
      : undefined;
  const byParty = company
    ? trackings.find(
        (t) => t.searchType !== "cnj" && t.partyId === partyId(company),
      )
    : undefined;
  return (byLawsuit ?? byParty)?.id ?? null;
}

const A = (
  n: number,
  type: AlertView["type"],
  company: CompanyKey | null,
  eventN: number | null,
  lawsuitCnj: string | null,
  title: string,
  description: string,
  createdAt: string,
  readAt: string | null,
): AlertView => ({
  id: alertId(n),
  type,
  partyId: company ? partyId(company) : null,
  webhookEventId: eventN ? mockId(4, eventN) : null,
  trackingId: demoTrackingFor(company, lawsuitCnj, type),
  lawsuitCnj,
  dedupeKey: `demo:${n}`,
  title,
  description,
  createdAt: at(createdAt),
  readAt: readAt ? at(readAt) : null,
});

export const alerts: AlertView[] = [
  A(
    1,
    "new_lawsuit",
    "aurora",
    1,
    cnjOf("1013310"),
    "Novo processo identificado",
    "Um novo processo no TJSP foi associado ao CNPJ monitorado.",
    "2026-10-10T07:05:13",
    null,
  ),
  A(
    2,
    "lawsuit_movement",
    "aurora",
    3,
    cnjOf("1004512"),
    "Nova movimentação processual",
    "Juntada de petição intermediária.",
    "2026-10-09T15:24:04",
    null,
  ),
  A(
    3,
    "lawsuit_movement",
    "bravo",
    4,
    cnjOf("1001458"),
    "Nova movimentação processual",
    "Juntada de laudo pericial.",
    "2026-10-09T10:34:52",
    null,
  ),
  A(
    4,
    "lawsuit_movement",
    null,
    6,
    cnjOf("0718455"),
    "Nova movimentação processual",
    "Decisão interlocutória publicada.",
    "2026-10-08T17:35:28",
    "2026-10-09T09:00",
  ),
  A(
    7,
    "tracking_notice",
    "semNome",
    8,
    null,
    "Monitoramento com falha",
    "A última execução do monitoramento por CNPJ não pôde ser processada.",
    "2026-10-07T03:10:17",
    null,
  ),
  A(
    5,
    "new_lawsuit",
    "aurora",
    9,
    cnjOf("1012045"),
    "Novo processo identificado",
    "Processo distribuído no TJSP com a empresa no polo passivo.",
    "2026-10-06T08:12:31",
    "2026-10-06T10:20",
  ),
  A(
    8,
    "tracking_notice",
    "delta",
    null,
    cnjOf("1008840"),
    "Monitoramento pausado",
    "O acompanhamento do processo foi pausado.",
    "2026-09-15T12:00:00",
    "2026-09-15T14:00",
  ),
  A(
    6,
    "lawsuit_movement",
    "bravo",
    11,
    cnjOf("1020336"),
    "Nova movimentação processual",
    "Sentença publicada.",
    "2026-10-03T14:05:38",
    "2026-10-04T08:30",
  ),
];

// Atividade recente

const act = (
  n: number,
  kind: ActivityItem["kind"],
  title: string,
  description: string,
  occurredAt: string,
  company: CompanyKey | null,
  href: string | null,
): ActivityItem => ({
  id: mockId(6, n),
  kind,
  title,
  description,
  occurredAt: at(occurredAt),
  partyId: company ? partyId(company) : null,
  href,
});

export const activity: ActivityItem[] = [
  act(
    1,
    "new_lawsuit",
    "Novo processo identificado",
    "Aurora Logística Integrada Ltda. · TJSP",
    "2026-10-10T07:05:13",
    "aurora",
    "/acervo/cnpj/10101010000177",
  ),
  act(
    2,
    "webhook_received",
    "Webhook recebido",
    "response_created aguardando processamento",
    "2026-10-10T06:58:40",
    "bravo",
    "/webhooks",
  ),
  act(
    3,
    "tracking_created",
    "Monitoramento criado",
    "CNPJ 30.303.030/0001-38 · Cedro Alimentos do Brasil Ltda.",
    "2026-10-09T16:40:00",
    "cedro",
    "/acervo?monitorado=1",
  ),
  act(
    4,
    "lawsuit_movement",
    "Movimentação processual recebida",
    "Juntada de petição intermediária · TJSP",
    "2026-10-09T15:24:04",
    "aurora",
    "/acervo/cnpj/10101010000177",
  ),
  act(
    5,
    "lawsuit_movement",
    "Movimentação processual recebida",
    "Juntada de laudo pericial · TRT-15",
    "2026-10-09T10:34:52",
    "bravo",
    "/acervo/cnpj/20202020000152",
  ),
  act(
    6,
    "processing_failed",
    "Falha no processamento de evento",
    "reference_id sem monitoramento local correspondente",
    "2026-10-08T22:13:09",
    null,
    "/webhooks",
  ),
  act(
    7,
    "lawsuit_movement",
    "Movimentação processual recebida",
    "Decisão interlocutória publicada · TJSP",
    "2026-10-08T17:35:28",
    null,
    "/acervo",
  ),
  act(
    8,
    "processing_failed",
    "Falha no processamento de evento",
    "Payload sem response_data",
    "2026-10-07T03:10:17",
    "semNome",
    "/webhooks",
  ),
  act(
    9,
    "new_lawsuit",
    "Novo processo identificado",
    "Aurora Logística Integrada Ltda. · TJSP",
    "2026-10-06T08:12:31",
    "aurora",
    "/acervo/cnpj/10101010000177",
  ),
  act(
    10,
    "tracking_created",
    "Monitoramento criado",
    "CNPJ 70.707.070/0010-50",
    "2026-10-02T17:20:00",
    "semNome",
    "/acervo?monitorado=1",
  ),
];

// Consultas (página Consultas). Na demonstração nada é consultado de fato:
// são linhas fictícias no mesmo formato das gravadas no modo "db".

const companyCnpj = (key: CompanyKey) =>
  companyParties[companyRows.findIndex(([k]) => k === key)].document;

const Q = (
  n: number,
  flow: QueryView["flow"],
  mode: QueryView["mode"],
  company: CompanyKey,
  createdAt: string,
  result: Partial<QueryView>,
): QueryView => ({
  id: mockId(7, n),
  flow,
  mode,
  partyId: partyId(company),
  searchType: "cnpj",
  searchKey: companyCnpj(company),
  createdAt: at(createdAt),
  requestId: flow === "async" ? mockId(8, n) : null,
  asyncStatus: null,
  syncOutcome: null,
  resultCount: null,
  delivery: null,
  lastCheckedAt: null,
  ...result,
});

export const queries: QueryView[] = [
  Q(1, "async", "historical_on_demand", "aurora", "2026-10-10T17:20", {
    asyncStatus: "started",
    delivery: "polling",
    lastCheckedAt: at("2026-10-10T17:35"),
  }),
  Q(2, "sync", "datalake_sync", "aurora", "2026-10-10T09:12", {
    syncOutcome: "ok",
    resultCount: 6,
  }),
  Q(3, "async", "historical_async", "bravo", "2026-10-09T16:40", {
    asyncStatus: "completed",
    delivery: "webhook",
  }),
  Q(4, "sync", "registration_data", "cedro", "2026-10-09T11:05", {
    syncOutcome: "ok",
    resultCount: 1,
  }),
  Q(5, "sync", "datalake_sync", "delta", "2026-10-08T14:30", {
    syncOutcome: "uncertain",
  }),
];
