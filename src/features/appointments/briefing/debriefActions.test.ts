import { describe, expect, it } from "vitest";
import { debriefTopic, needsQuickDebrief, promiseTask, quickDebriefNotes } from "./debriefActions";

describe("debrief actions", () => {
  it("builds an editorial idea from the appointment", () => {
    const t = debriefTopic("Firmenbesuch Müller", "Neue Halle eröffnet");
    expect(t.topic).toBe("Termin: Firmenbesuch Müller");
    expect(t.status).toBe("idea");
    expect(t.short_description).toBe("Neue Halle eröffnet");
  });
  it("rejects empty promises", () => expect(promiseTask("  ")).toBeNull());
  it("names the contact in a promise", () =>
    expect(promiseTask("Beim Ministerium nachhaken", "Bürgermeister Müller")?.description).toContain("Bürgermeister Müller"));
  it("formats the 3-line quick debrief", () =>
    expect(quickDebriefNotes("Einig", "Brief schreiben")).toBe("Ergebnis: Einig\nNächster Schritt: Brief schreiben"));
  it("ignores an empty quick debrief", () => expect(quickDebriefNotes("", " ")).toBeNull());
  it("asks for a debrief only when notes are missing", () => {
    expect(needsQuickDebrief(null)).toBe(true);
    expect(needsQuickDebrief({ notes: "x", feedback_status: "pending" })).toBe(false);
    expect(needsQuickDebrief({ notes: null, feedback_status: "completed" })).toBe(false);
  });
});
