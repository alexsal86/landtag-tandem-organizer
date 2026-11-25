import { describe, expect, it } from "vitest";
import { stepDiagnostic } from "./stepDiagnostics";

describe("Schritt-Diagnose", () => {
  it("nennt Prüfpunkt, Fehlercode und Kurzdetails eines geworfenen Fehlers", () => {
    expect(stepDiagnostic({
      id: "archive", label: "Archivierung", status: "failed", message: "RLS verweigert (new row violates row-level security policy).",
      details: { step: { id: "archive", label: "Archivierung" }, error: { code: "42501", message: "new row violates row-level security policy", details: "policy letters_insert", hint: "Büro prüfen" } },
    })).toEqual({ point: "Archivierung (archive)", code: "42501", summary: "policy letters_insert" });
  });

  it("trennt den Code aus älteren Meldungen ohne strukturierte Details", () => {
    expect(stepDiagnostic({
      id: "check", label: "Prüfen", status: "failed",
      message: "Prüfung kaputt · Code 23503 · Details: Key (task_id)=(abc) is not present",
    })).toEqual({ point: "Prüfen (check)", code: "23503", summary: "Prüfung kaputt · Details: Key (task_id)=(abc) is not present" });
  });

  it("fasst Soll/Ist-Abweichungen kurz zusammen", () => {
    expect(stepDiagnostic({
      id: "verify", label: "Felder prüfen", status: "failed", message: "Felder: 2 Abweichung(en) — status, sent_by",
      details: [{ field: "status", expected: "sent", actual: "draft" }, { field: "sent_by", expected: "u1", actual: null }],
    })).toMatchObject({ point: "Felder prüfen (verify)", summary: "2 Abweichung(en) — status: Soll sent, Ist draft · sent_by: Soll u1, Ist null" });
  });

  it("kürzt lange Details und liefert für bestandene Schritte nichts", () => {
    const long = stepDiagnostic({ id: "x", label: "Langer Befund", status: "failed", message: "x".repeat(200) });
    expect(long?.summary?.length).toBeLessThanOrEqual(140);
    expect(long?.summary?.endsWith("…")).toBe(true);
    expect(stepDiagnostic({ id: "ok", label: "OK", status: "ok", message: "bestanden" })).toBeNull();
  });
});
