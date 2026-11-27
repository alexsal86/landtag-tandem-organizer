import { describe, expect, it } from "vitest";
import { stepDiagnostic } from "./stepDiagnostics";

describe("Schritt-Diagnose", () => {
  it("nennt Prüfpunkt, Fehlercode und Kurzdetails eines geworfenen Fehlers", () => {
    expect(stepDiagnostic({
      id: "archive", label: "Archivierung", status: "failed", message: "RLS verweigert (new row violates row-level security policy).",
      details: { step: { id: "archive", label: "Archivierung" }, error: { code: "42501", message: "new row violates row-level security policy", details: "policy letters_insert", hint: "Büro prüfen" } },
    })).toEqual({
      point: "Archivierung (archive)", code: "42501", summary: "policy letters_insert", fullSummary: "policy letters_insert",
    });
  });

  it("trennt den Code aus älteren Meldungen ohne strukturierte Details", () => {
    expect(stepDiagnostic({
      id: "check", label: "Prüfen", status: "failed",
      message: "Prüfung kaputt · Code 23503 · Details: Key (task_id)=(abc) is not present",
    })).toEqual({
      point: "Prüfen (check)", code: "23503",
      summary: "Prüfung kaputt · Details: Key (task_id)=(abc) is not present",
      fullSummary: "Prüfung kaputt · Details: Key (task_id)=(abc) is not present",
    });
  });

  it("fasst Soll/Ist-Abweichungen kurz zusammen", () => {
    expect(stepDiagnostic({
      id: "verify", label: "Felder prüfen", status: "failed", message: "Felder: 2 Abweichung(en) — status, sent_by",
      details: [{ field: "status", expected: "sent", actual: "draft" }, { field: "sent_by", expected: "u1", actual: null }],
    })).toMatchObject({ point: "Felder prüfen (verify)", summary: "2 Abweichung(en) — status: Soll sent, Ist draft · sent_by: Soll u1, Ist null" });
  });

  it("nennt bei Workflow-Schritten die nicht erfüllte Teilprüfung und den beobachteten Code", () => {
    expect(stepDiagnostic({
      id: "release-guard", label: "Freigabe nur über den Workflow", status: "failed",
      message: "Direkte Statusänderung, vorzeitige Freigabe, Bestätigung und Wiedereröffnung werden abgewiesen; der veraltete Autosave-Stand ebenfalls, ohne Auditzeile.",
      details: {
        directWriteDenied: true, reopenBeforeCompletion: false, staleVersionRejected: false, noAuditRows: true,
        errors: { direct: "42501", reopen: "P0001", stale: "40001", ohneCode: null },
      },
    })).toMatchObject({
      point: "Freigabe nur über den Workflow (release-guard)",
      summary: "Nicht erfüllt: reopenBeforeCompletion, staleVersionRejected · Ist-Codes: direct 42501, reopen P0001, stale 40001",
    });
  });

  it("zeigt beobachtete Codes auch ohne einzeln aufgelistete Fehlprüfung", () => {
    expect(stepDiagnostic({
      id: "foreign-tenant", label: "Fremdtenant", status: "failed",
      message: "Tenant- und Rollenprüfungen werden serverseitig erzwungen.",
      details: { errors: { lifecycle: "23503" } },
    })).toMatchObject({ summary: "Ist-Codes: lifecycle 23503" });
  });

  it("liest die Codes älterer Läufe auch aus Schlüsseln wie lifecycleCode", () => {
    expect(stepDiagnostic({
      id: "foreign-tenant", label: "Fremdtenant", status: "failed",
      message: "Tenant- und Rollenprüfungen werden serverseitig erzwungen.",
      details: { lifecycleCode: "PGRST202", reminderCode: "42501" },
    })).toMatchObject({
      summary: "Ist-Codes: lifecycleCode PGRST202, reminderCode 42501",
    });
  });

  it("lässt Details ohne Prüfergebnis und ohne Codes unangetastet", () => {
    expect(stepDiagnostic({
      id: "save", label: "Speichern", status: "failed", message: "Speichern fehlgeschlagen",
      details: { ticket: "abc", retried: 2 },
    })).toMatchObject({ summary: "Speichern fehlgeschlagen" });
  });

  it("kürzt die Prüfzusammenfassung nur am Ende", () => {
    const many = Object.fromEntries(Array.from({ length: 30 }, (_, index) => [`check${index}`, false]));
    const diagnostic = stepDiagnostic({
      id: "many", label: "Viele Prüfungen", status: "failed", message: "Viele Prüfungen fehlgeschlagen", details: many,
    });
    expect(diagnostic?.summary?.startsWith("Nicht erfüllt: check0, check1")).toBe(true);
    expect(diagnostic?.summary?.length).toBe(140);
    expect(diagnostic?.summary?.endsWith("…")).toBe(true);
  });

  it("kürzt lange Details und liefert für bestandene Schritte nichts", () => {
    const long = stepDiagnostic({ id: "x", label: "Langer Befund", status: "failed", message: "x".repeat(200) });
    expect(long?.summary?.length).toBeLessThanOrEqual(140);
    expect(long?.summary?.endsWith("…")).toBe(true);
    // Der volle Text bleibt daneben erhalten, damit der System-Puls ihn zeigen kann.
    expect(long?.fullSummary).toBe("x".repeat(200));
    expect(stepDiagnostic({ id: "ok", label: "OK", status: "ok", message: "bestanden" })).toBeNull();
  });
});
