import type { AppointmentPreparation } from "@/hooks/useAppointmentPreparation";

type LibraryFact = { id: string; text: string; source?: string | null };
export function briefingFactLines(data: AppointmentPreparation["preparation_data"], library: LibraryFact[]): string[] {
  const byId = new Map(library.map(f => [f.id, f]));
  return (data.structured_facts ?? []).map(f => {
    const live = f.fact_id ? byId.get(f.fact_id) : undefined;
    const text = f.text?.trim() || live?.text || (f.fact_id ? "Verknüpfter Fakt nicht verfügbar" : "");
    const source = f.source || live?.source;
    return text ? text + (source ? ` (Quelle: ${source})` : "") : "";
  }).filter(Boolean);
}
