import { describe, expect, it } from "vitest";
import {
  AUDIT_FILTER_OPTIONS,
  SECURITY_EVENT_ACTIONS,
  SECURITY_EVENT_GROUPS,
  auditActionsFor,
  isSecurityEventAction,
  securityGroupForAction,
  type AuditFilter,
} from "./auditSecurityFilter";

describe("Audit-Filter des Security-Cockpits", () => {
  it("ordnet jede sicherheitskritische Aktion genau einer Gruppe zu", () => {
    for (const action of SECURITY_EVENT_ACTIONS) {
      expect(securityGroupForAction(action), action).not.toBeNull();
    }
    const seen = new Set<string>();
    for (const group of SECURITY_EVENT_GROUPS) {
      for (const action of group.actions) {
        expect(seen.has(action), `${action} ist doppelt zugeordnet`).toBe(false);
        seen.add(action);
      }
    }
    expect(seen.size).toBe(SECURITY_EVENT_ACTIONS.length);
  });

  it("erkennt die Ereignisse der Schreibpfade", () => {
    expect(securityGroupForAction("security.gdpr.delete_approved")?.id).toBe("gdpr");
    expect(securityGroupForAction("security.gdpr.delete_completed")?.id).toBe("gdpr");
    expect(securityGroupForAction("user.role_changed")?.id).toBe("roles");
    expect(securityGroupForAction("auth.login_failed")?.id).toBe("auth");
    expect(securityGroupForAction("security.access_denied")?.id).toBe("access");
  });

  it("deckt Anlegen und Zurückziehen eines DSGVO-Antrags mit ab", () => {
    // Genau diese beiden Ereignisse fehlten, obwohl die Gruppe „Löschanträge“ heißt.
    expect(securityGroupForAction("security.gdpr.request_created")?.id).toBe("gdpr");
    expect(securityGroupForAction("security.gdpr.request_withdrawn")?.id).toBe("gdpr");

    const gdpr = SECURITY_EVENT_GROUPS.find((group) => group.id === "gdpr");
    expect(gdpr?.actions).toEqual([
      "security.gdpr.request_created",
      "security.gdpr.request_withdrawn",
      "security.gdpr.delete_approved",
      "security.gdpr.delete_completed",
      "security.gdpr.export_completed",
    ]);
  });

  it("benennt die DSGVO-Gruppe nach dem, was tatsächlich geschrieben wird", () => {
    const gdpr = AUDIT_FILTER_OPTIONS.find((option) => option.id === "gdpr");
    expect(gdpr?.title).toMatch(/angelegt/);
    expect(gdpr?.title).toMatch(/zurückgezogen/);
    expect(gdpr?.title).toMatch(/freigegeben/);
    expect(gdpr?.title).toMatch(/ausgeführt/);
  });

  it("lässt fachliche Ereignisse ungefiltert", () => {
    for (const action of ["letter.sent", "document.deleted", "case_item.status_changed", "unknown"]) {
      expect(isSecurityEventAction(action), action).toBe(false);
      expect(securityGroupForAction(action), action).toBeNull();
    }
  });

  it("übersetzt den Filter in Datenbankaktionen statt in eine Client-Auswahl", () => {
    expect(auditActionsFor("all")).toBeNull();
    expect(auditActionsFor("security")).toEqual([...SECURITY_EVENT_ACTIONS]);
    expect(auditActionsFor("unbekannt" as AuditFilter)).toEqual([]);
    for (const group of SECURITY_EVENT_GROUPS) {
      expect(auditActionsFor(group.id)).toEqual([...group.actions]);
    }
  });

  it("bietet je Gruppe eine Schaltfläche und keine doppelten Filter", () => {
    const ids = AUDIT_FILTER_OPTIONS.map((option) => option.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(["all", "security", ...SECURITY_EVENT_GROUPS.map((group) => group.id)]);
    for (const option of AUDIT_FILTER_OPTIONS) {
      expect(option.label.length).toBeGreaterThan(0);
      expect(option.title.length).toBeGreaterThan(option.label.length);
    }
  });
});
