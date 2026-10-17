import type { Party, SearchType, Tracking } from "@/db/models";
import type { AlertView } from "@/features/alerts/types";
import { SEARCH_TYPES } from "@/features/consult/identify";
import type { QueryView } from "@/features/queries/types";
import {
  getTrackingDisplayState,
  isTrackingClosed,
} from "@/features/trackings/types";

// Um "assunto" (decisão D2 do círculo 3): qualquer identificador que a
// pessoa pesquisou, monitorou ou salvou, com o nome quando houver. É a
// unidade da página Minhas informações. Não há coleção própria: o assunto
// é montado do histórico de consultas, dos monitoramentos e das partes.

export type Subject = {
  searchType: SearchType;
  searchKey: string;
  // Nome da parte salva (CPF, CNPJ) ou o próprio nome pesquisado.
  name: string | null;
  queries: number;
  lastQueryAt: Date | null;
  // Monitoramentos não excluídos.
  trackings: number;
  // Algum monitoramento vigiando (não pausado nem encerrado).
  monitored: boolean;
  unreadAlerts: number;
  // A atividade mais recente (consulta, monitoramento ou parte salva).
  lastActivityAt: Date;
};

export const SUBJECT_TYPES = Object.keys(SEARCH_TYPES) as SearchType[];

export function subjectKey(type: SearchType, key: string): string {
  return `${type}:${key}`;
}

// Endereço da ficha. A chave vai codificada: um nome tem espaços.
export function subjectHref(type: SearchType, key: string): string {
  return `/informacoes/${type}/${encodeURIComponent(key)}`;
}

export function isSearchType(value: string): value is SearchType {
  return (SUBJECT_TYPES as string[]).includes(value);
}

export function buildSubjects(data: {
  queries: QueryView[];
  trackings: Tracking[];
  parties: Party[];
  alerts: AlertView[];
}): Subject[] {
  const subjects = new Map<string, Subject>();
  const get = (type: SearchType, key: string, at: Date): Subject => {
    const id = subjectKey(type, key);
    let subject = subjects.get(id);
    if (!subject) {
      subject = {
        searchType: type,
        searchKey: key,
        name: type === "name" ? key : null,
        queries: 0,
        lastQueryAt: null,
        trackings: 0,
        monitored: false,
        unreadAlerts: 0,
        lastActivityAt: at,
      };
      subjects.set(id, subject);
    }
    if (at > subject.lastActivityAt) subject.lastActivityAt = at;
    return subject;
  };

  for (const query of data.queries) {
    const subject = get(query.searchType, query.searchKey, query.createdAt);
    subject.queries++;
    if (!subject.lastQueryAt || query.createdAt > subject.lastQueryAt) {
      subject.lastQueryAt = query.createdAt;
    }
  }

  const trackingSubject = new Map<string, Subject>();
  for (const tracking of data.trackings) {
    if (tracking.status === "deleted") continue;
    const subject = get(
      tracking.searchType,
      tracking.searchKey,
      tracking.updatedAt,
    );
    subject.trackings++;
    // Pausado continua ocupando o identificador, mas não está vigiando.
    if (
      !isTrackingClosed(tracking) &&
      getTrackingDisplayState(tracking) !== "paused"
    ) {
      subject.monitored = true;
    }
    trackingSubject.set(tracking.id, subject);
  }

  for (const party of data.parties) {
    get(party.documentType, party.document, party.updatedAt).name = party.name;
  }

  for (const alert of data.alerts) {
    if (alert.readAt || !alert.trackingId) continue;
    const subject = trackingSubject.get(alert.trackingId);
    if (subject) subject.unreadAlerts++;
  }

  return [...subjects.values()].sort(
    (a, b) =>
      b.unreadAlerts - a.unreadAlerts ||
      b.lastActivityAt.getTime() - a.lastActivityAt.getTime(),
  );
}

export type SubjectFilter = {
  type: SearchType | "all";
  monitoredOnly: boolean;
  text: string;
};

// Filtro da lista: tipo, só monitorados e um texto (nome ou parte da chave).
export function filterSubjects(
  subjects: Subject[],
  filter: SubjectFilter,
): Subject[] {
  const term = filter.text.trim().toLowerCase();
  const compact = term.replace(/[^0-9a-z]/g, "");
  return subjects.filter((s) => {
    if (filter.type !== "all" && s.searchType !== filter.type) return false;
    if (filter.monitoredOnly && !s.monitored) return false;
    if (!term) return true;
    return (
      !!s.name?.toLowerCase().includes(term) ||
      (compact.length >= 3 && s.searchKey.toLowerCase().includes(compact))
    );
  });
}
