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
  question_edited: "Frage bearbeitet",
  question_archived: "Frage archiviert",
  question_merged: "Duplikat zusammengeführt",
  question_created: "Frage gestellt",
  answer_changed: "Antwort oder Anhänge geändert",
  verified: "Als aktuell bestätigt",
  review_requested: "Überprüfung angefordert",
  assignee_changed: "Zuständigkeit geändert",
};
