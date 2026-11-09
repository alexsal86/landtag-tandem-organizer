import { describe, expect, it } from "vitest";
import { canCompleteBriefing, canGoLive, compactToFull, dossierExtrasLine, followUpTaskFromLive, mergeLegacy, saveCompact } from "./briefingModel";

describe("briefing model (one record, two zoom levels)", () => {
  it("compact positions become dossier talking points", () => {
    const full = compactToFull({ compact_positions: "- Radweg ausbauen\n- Fördermittel" });
    expect(full.talking_point_items).toEqual([{ id: "c-0", point: "Radweg ausbauen", text: "Radweg ausbauen", background: "" }, { id: "c-1", point: "Fördermittel", text: "Fördermittel", background: "" }]);
  });
  it("never overwrites richer dossier data", () => {
    const full = compactToFull({ compact_goal: "neu" }, { objectives: "alt" });
    expect(full.objectives).toBeUndefined();
  });
  it("legacy dossier fills the empty compact view", () => {
    const c = mergeLegacy({ conversation_partners: [{ name: "Dr. Meier", role: "Bürgermeisterin" }], qa_pairs: [{ question: "Kosten?", answer: "2 Mio" }] });
    expect(c.compact_partners).toBe("Dr. Meier, Bürgermeisterin");
    expect(c.compact_qa).toBe("Kosten? → 2 Mio");
  });
  it("round trip compact → full → compact keeps the content", () => {
    const saved = saveCompact({}, { ...mergeLegacy({}), compact_qa: "Kosten? → 2 Mio" });
    const { compact_qa: _drop, ...withoutCompact } = saved;
    expect(mergeLegacy(withoutCompact).compact_qa).toBe("Kosten? → 2 Mio");
  });
  it("shows dossier program as one line", () => {
    expect(dossierExtrasLine({ program: [{ time: "14:00", item: "Begrüßung" }, { time: "14:30", item: "Rundgang" }] })).toBe("Ablauf: 14:00 Begrüßung · 14:30 Rundgang");
    expect(dossierExtrasLine({})).toBeNull();
  });
  it("live mode only for approved briefings on the appointment day", () => {
    const now = new Date(2026, 10, 9, 8);
    expect(canGoLive({ briefing_status: "approved", start_time: new Date(2026, 10, 9, 15).toISOString() }, now)).toBe(true);
    expect(canGoLive({ briefing_status: "in_review", start_time: new Date(2026, 10, 9, 15).toISOString() }, now)).toBe(false);
    expect(canGoLive({ briefing_status: "approved", start_time: new Date(2026, 10, 10, 15).toISOString() }, now)).toBe(false);
  });
  it("live quick task needs a title and defaults to medium priority", () => {
    expect(followUpTaskFromLive("a", { title: "  " })).toBeNull();
    expect(followUpTaskFromLive("a", { title: "Ministerium anschreiben" })?._priority).toBe("medium");
  });
  it("briefing closes only when approved and debrief written", () => {
    expect(canCompleteBriefing("approved", "Vereinbart: Folgetermin")).toBe(true);
    expect(canCompleteBriefing("approved", " ")).toBe(false);
    expect(canCompleteBriefing("in_review", "x")).toBe(false);
  });
});
