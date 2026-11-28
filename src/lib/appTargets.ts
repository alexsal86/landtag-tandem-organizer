import { format } from "date-fns";

/**
 * Zentrale Ziel-Registry für Sprungziele in der App.
 *
 * Jede Trefferart und jeder Quick-Access-Eintrag hat genau eine Route, die den
 * Datensatz wirklich öffnet. Die Parameter richten sich nach den tatsächlich
 * ausgewerteten Stellen der Zielviews (z. B. `protocol` in MeetingsView,
 * `caseFileId` in CaseFilesView), nicht nach den früheren `/?section=…`-Links:
 * die verliefen über die `/`-Weiterleitung nach `/mywork` und verloren dabei
 * ihre Parameter.
 */

export type SearchEntityType =
  | "contact"
  | "appointment"
  | "task"
  | "archivedTask"
  | "document"
  | "letter"
  | "protocol"
  | "caseFile"
  | "decision"
  | "archivedDecision"
  | "planning";

export interface SearchTargetRow {
  id: string;
  /** Nur für Termine: bestimmt den im Kalender angezeigten Tag. */
  start_time?: string | null;
}

const encode = (value: string): string => encodeURIComponent(value);

const withQuery = (path: string, params: Record<string, string>): string => {
  const search = new URLSearchParams(params).toString();
  return search ? `${path}?${search}` : path;
};

/** Dokument in der Dokumentenliste öffnen. */
export function buildDocumentHref(documentId: string): string {
  return withQuery("/documents", { document: documentId });
}

/** Vorgang in der Vorgangsliste von „Meine Arbeit“ öffnen. */
export function buildCaseItemHref(caseItemId: string): string {
  return withQuery("/mywork", { tab: "cases", caseItemId });
}

/** Verwaltungsbereich über die kanonischen Abschnittsnamen öffnen. */
export function buildAdminHref(adminSection: string, adminSubSection?: string): string {
  return withQuery(
    "/administration",
    adminSubSection ? { adminSection, adminSubSection } : { adminSection },
  );
}

export function buildSearchHref(type: SearchEntityType, row: SearchTargetRow): string {
  const id = row.id;

  switch (type) {
    case "contact":
      return `/contacts/${encode(id)}`;
    case "appointment": {
      const params: Record<string, string> = { highlight: id };
      if (row.start_time) {
        const start = new Date(row.start_time);
        if (!Number.isNaN(start.getTime())) {
          params.date = format(start, "yyyy-MM-dd");
        }
      }
      return withQuery("/calendar", params);
    }
    case "task":
      return withQuery("/tasks", { task: id });
    case "archivedTask":
      return withQuery("/tasks/archive", { highlight: id });
    case "document":
      return buildDocumentHref(id);
    case "letter":
      return `/letters/${encode(id)}`;
    case "protocol":
      return withQuery("/meetings", { protocol: id });
    case "caseFile":
      return withQuery("/casefiles", { caseFileId: id });
    case "decision":
    case "archivedDecision":
      return withQuery("/decisions", { highlight: id });
    case "planning":
      return `/eventplanning/${encode(id)}`;
  }
}
