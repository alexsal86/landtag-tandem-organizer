import type { AnnotationPatch } from "./types";
export interface AnnotationEvent {
  id: string;
  annotation_id: string;
  thread_id: string;
  actor_id: string | null;
  event_type: "created" | "updated" | "deleted";
  before_data: AnnotationPatch | null;
  after_data: AnnotationPatch | null;
  created_at: string;
}
const FIELDS: Record<keyof AnnotationPatch, string> = {
  content: "Kommentar",
  color: "Farbe",
  resolved: "Erledigt-Status",
  assigned_to: "Zuständigkeit",
  target_selector: "Markierung",
  quote_text: "Textauswahl",
  page_number: "Seite",
  file_version: "Dateiversion",
};
export function annotationEventLabel(
  event: Pick<AnnotationEvent, "event_type" | "before_data" | "after_data">,
): string {
  if (event.event_type === "created") return "Anmerkung erstellt";
  if (event.event_type === "deleted") return "Anmerkung gelöscht";
  const changed = (Object.keys(FIELDS) as (keyof AnnotationPatch)[]).filter(
    (key) =>
      JSON.stringify(event.before_data?.[key]) !==
      JSON.stringify(event.after_data?.[key]),
  );
  return `${changed.map((key) => FIELDS[key]).join(", ") || "Anmerkung"} geändert`;
}
