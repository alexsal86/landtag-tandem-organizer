import { describe, expect, it } from "vitest";
import { buildTenantSteps, openTenantSteps } from "./steps";

describe("Übergabe-Checkliste eines neuen Büros", () => {
  it("meldet ein frisch angelegtes Büro ohne Benutzer und Absender als offen", () => {
    const steps = buildTenantSteps({ users: 0, senderCount: 0, hasLogo: false, calendars: 0 });
    expect(openTenantSteps(steps)).toEqual(["admin", "sender", "logo", "members", "calendar"]);
    expect(steps.admin.detail).toContain("kein aktiver Benutzer");
  });

  it("wertet einen angelegten Admin mit Standard-Absender als erledigt", () => {
    const steps = buildTenantSteps({ users: 1, senderCount: 1, hasLogo: true, calendars: 1 });
    expect(openTenantSteps(steps)).toEqual(["members"]);
    expect(steps.sender.detail).toBe("1 Absender");
  });

  it("prüft Logo und Kalender nur, wenn die Angabe vorliegt", () => {
    const steps = buildTenantSteps({ users: 2, senderCount: 2 });
    expect(openTenantSteps(steps)).toEqual([]);
    expect(steps.logo.detail).toBe("nicht geprüft");
    expect(steps.calendar.detail).toBe("keine Kalenderkennzahl");
  });
});
