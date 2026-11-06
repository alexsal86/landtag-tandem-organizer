import type { TimelineEvent } from "@/components/my-work/hooks/useCaseItemEdit";

const stepTitles = ["Schritt festgelegt", "Schritt geändert"];
const rank = (title: string) => title === "Am Zug geändert" ? 0 : stepTitles.includes(title) ? 1 : title === "Auf Wiedervorlage gelegt" ? 2 : -1;

/** Present legacy events from the same save together, preserving their stored records. */
export function mergeStepChangeEvents(events: TimelineEvent[]): TimelineEvent[] {
  const sorted = [...events].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  const result: TimelineEvent[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const first = sorted[i];
    const group = [first];
    if (first.type === "system" && rank(first.title) >= 0 && !first.documents?.length) {
      while (i + group.length < sorted.length) {
        const candidate = sorted[i + group.length];
        const elapsed = Date.parse(candidate.timestamp) - Date.parse(first.timestamp);
        if (candidate.type !== "system" || candidate.documents?.length || candidate.actorName !== first.actorName
          || rank(candidate.title) <= rank(group[group.length - 1].title) || !Number.isFinite(elapsed) || elapsed < 0 || elapsed > 1000) break;
        group.push(candidate);
      }
    }
    const step = group.find((event) => stepTitles.includes(event.title));
    if (group.length < 2 || !step) { result.push(first); continue; }
    const owner = group.find((event) => event.title === "Am Zug geändert");
    const resubmission = group.find((event) => event.title === "Auf Wiedervorlage gelegt");
    const parts = step.note?.split(" · ") ?? [];
    const responsibleName = step.responsibleName ?? parts.find((part) => part.startsWith("Zuständig: "))?.slice("Zuständig: ".length);
    const description = parts.filter((part) => !part.startsWith("Zuständig: "));
    const due = !description.some((part) => part.startsWith("Frist: ")) && resubmission?.note?.startsWith("bis ") ? `Frist: ${resubmission.note.slice(4)}` : null;
    result.push({ ...step, id: first.id, title: `${step.title === "Schritt festgelegt" ? "Neuer Schritt festgelegt" : "Schritt geändert"}${resubmission ? " + Wiedervorlage" : ""}`,
      note: [owner?.note, ...description, due].filter(Boolean).join(" · "), responsibleName });
    i += group.length - 1;
  }
  return result;
}
