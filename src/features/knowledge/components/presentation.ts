import type { TenantProfileOption } from "@/hooks/useTenantProfiles";

export const formatKnowledgeDate = (value: string) =>
  new Date(value).toLocaleString("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  });
export const knowledgePersonName = (
  profiles: TenantProfileOption[],
  id: string | null,
) =>
  id
    ? profiles.find((profile) => profile.user_id === id)?.display_name ||
      "Ehemaliger Mitarbeiter"
    : "Noch nicht zugeordnet";
export const KNOWLEDGE_EVENT_NAMES: Record<string, string> = {
  tags_changed: "Tags geändert",
  sources_changed: "Quellen geändert",
  comment_added: "Rückfrage",
  outdated_reported: "Als veraltet gemeldet",
  question_edited: "Frage bearbeitet",
  question_archived: "Frage archiviert",
  question_merged: "Duplikat zusammengeführt",
  question_created: "Frage gestellt",
  answer_changed: "Antwort oder Anhänge geändert",
  verified: "Als aktuell bestätigt",
  review_requested: "Überprüfung angefordert",
  assignee_changed: "Zuständigkeit geändert",
};

export const knowledgeOpenDays = (createdAt: string, now: number) =>
  Math.max(0, Math.floor((now - Date.parse(createdAt)) / 86_400_000));
export function formatKnowledgeRelativeDate(
  value: string,
  now = Date.now(),
): string {
  const seconds = (Date.parse(value) - now) / 1000;
  if (Math.abs(seconds) < 60) return "gerade eben";
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31536000],
    ["month", 2592000],
    ["week", 604800],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  const [unit, size] =
    units.find(([, size]) => Math.abs(seconds) >= size) ??
    units[units.length - 1];
  return new Intl.RelativeTimeFormat("de", { numeric: "auto" }).format(
    Math.trunc(seconds / size),
    unit,
  );
}
