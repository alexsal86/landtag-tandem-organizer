import { describe, expect, it } from "vitest";
import { mergeStepChangeEvents } from "./timeline";
import type { TimelineEvent } from "@/components/my-work/hooks/useCaseItemEdit";

const events: TimelineEvent[] = [
  { id: "a", type: "system", title: "Am Zug geändert", note: "Bürger → Verwaltung", timestamp: "2026-11-06T10:00:00.000Z", actorName: "Alexander" },
  { id: "b", type: "system", title: "Schritt festgelegt", note: "Antwort nachhalten · Frist: 27.11.2026 · Zuständig: Rudolf", timestamp: "2026-11-06T10:00:00.001Z", actorName: "Alexander" },
  { id: "c", type: "system", title: "Auf Wiedervorlage gelegt", note: "bis 27.11.2026", timestamp: "2026-11-06T10:00:00.002Z", actorName: "Alexander" },
];

describe("Zusammengefasste Schrittchronik", () => {
  it("fasst ältere Einträge zusammen, ohne Originale zu verändern", () => {
    const before = JSON.stringify(events);
    const result = mergeStepChangeEvents(events);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: "a", title: "Neuer Schritt festgelegt + Wiedervorlage", note: "Bürger → Verwaltung · Antwort nachhalten · Frist: 27.11.2026", responsibleName: "Rudolf", actorName: "Alexander" });
    expect(JSON.stringify(events)).toBe(before);
  });
  it("übernimmt die Frist aus dem Wiedervorlageeintrag, wenn sie im Schritt fehlt", () => {
    expect(mergeStepChangeEvents([{ ...events[1], note: "Nachhalten" }, events[2]])[0].note).toBe("Nachhalten · Frist: 27.11.2026");
  });
  it("fasst unterschiedliche Bearbeiter und getrennte Zeitpunkte nicht zusammen", () => {
    expect(mergeStepChangeEvents([events[0], { ...events[1], actorName: "Rudolf" }, events[2]])).toHaveLength(3);
    expect(mergeStepChangeEvents([events[0], { ...events[1], timestamp: "2026-11-06T10:01:00Z" }])).toHaveLength(2);
  });
  it("behält unabhängige Einträge, Anhänge und bereits zusammengefasste Schritte", () => {
    const combined = { ...events[0], title: "Neuer Schritt festgelegt + Wiedervorlage" };
    expect(mergeStepChangeEvents([combined])).toEqual([combined]);
    const attached = { ...events[1], documents: [{ id: "doc", title: "Brief", fileName: "Brief.pdf", filePath: "/brief.pdf" }] };
    expect(mergeStepChangeEvents([events[0], attached, events[2]])).toHaveLength(3);
    const interaction = { ...events[1], type: "interaktion" as const };
    expect(mergeStepChangeEvents([events[0], interaction, events[2]])).toHaveLength(3);
  });
});
