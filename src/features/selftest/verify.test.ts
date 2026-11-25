import { describe, expect, it, vi } from "vitest";
const result = vi.hoisted(() => ({ data: {} as Record<string, unknown>, error: null }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => ({ select: () => ({ eq: () => ({ single: async () => result }) }) }) } }));
import { describeError, expectFields, stepFailure } from "./verify";

describe("Feldverifikation", () => {
  it("erkennt denselben Zeitpunkt trotz unterschiedlicher Postgres- und Browserdarstellung", async () => {
    result.data = { approved_at: "2026-11-06T12:00:00+00:00" };
    expect((await expectFields("letters", "id", { approved_at: "2026-11-06T13:00:00.000+01:00" })).ok).toBe(true);
  });
  it("zeigt echte Abweichungen mit Soll und Ist", async () => {
    result.data = { approved_at: "2026-11-06T12:01:00+00:00" };
    const verification = await expectFields("letters", "id", { approved_at: "2026-11-06T12:00:00.000Z" });
    expect(verification.ok).toBe(false);
    expect(verification.details).toEqual([{ field: "approved_at", expected: "2026-11-06T12:00:00.000Z", actual: "2026-11-06T12:01:00+00:00" }]);
  });
  it("nennt bei einem Postgrest-Fehler Code, Details und Hinweis statt nur den Text", () => {
    const text = describeError({ message: "insert or update violates foreign key constraint", code: "23503", details: "Key (task_id)=(abc) is not present", hint: "Prüfe die verknüpfte Aufgabe." });
    expect(text).toContain("Code 23503");
    expect(text).toContain("Key (task_id)=(abc) is not present");
    expect(text).toContain("Prüfe die verknüpfte Aufgabe.");
  });
  it("ordnet einen geworfenen Fehler dem betroffenen Prüfpunkt zu", () => {
    const failure = stepFailure({ id: "archive", label: "Archivierung" }, Object.assign(new Error("RLS"), { code: "42501" }));
    expect(failure.ok).toBe(false);
    expect(failure.message).toContain("Code 42501");
    expect(failure.details).toMatchObject({ step: { id: "archive", label: "Archivierung" }, error: { code: "42501" } });
  });
  it("vergleicht Texte exakt und unterscheidet fehlende Werte von null", async () => {
    result.data = { subject: "Anderer Betreff", optional: null };
    expect((await expectFields("letters", "id", { subject: "Betreff" })).ok).toBe(false);
    expect((await expectFields("letters", "id", { optional: undefined })).ok).toBe(false);
  });
});
