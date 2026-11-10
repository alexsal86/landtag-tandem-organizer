import { describe, expect, it } from "vitest";
import { routineMonth, validateAnnualRoutine } from "./annualRoutines";
import { automationTabFromParams, normalizeAutomationParams } from "@/components/administration/automationNavigation";
import { RULE_TEMPLATES } from "@/components/administration/automationRule/constants";

describe("Gemeinsame Jahresroutinen", () => {
  it("gestattet automatische jährliche Büroaufgaben", () => {
    expect(validateAnnualRoutine("schedule", { schedule_kind: "annual" }, [{ type: "run_annual_routine" }])).toBeNull();
  });
  it("erhält manuelle Auslösung mit Jahresstichtag", () => {
    expect(validateAnnualRoutine("manual", { schedule_kind: "annual" }, [{ type: "run_annual_routine" }])).toBeNull();
  });
  it("verhindert monatliche Ausführung jährlicher Systemaktionen", () => {
    expect(validateAnnualRoutine("schedule", { schedule_kind: "monthly" }, [{ type: "run_annual_routine" }])).not.toBeNull();
  });
  it("verhindert beliebige Systemfunktionen", () => {
    expect(validateAnnualRoutine("manual", { schedule_kind: "annual" }, [{ type: "run_annual_routine", systemFunction: "delete_tenant" }])).not.toBeNull();
  });
  it("begrenzt eine Regel auf eine Jahresroutine", () => {
    expect(validateAnnualRoutine("manual", { schedule_kind: "annual" }, [{ type: "run_annual_routine" }, { type: "run_annual_routine" }])).not.toBeNull();
  });
  it("lehnt mehrere Zuständige in der Jahresübergabe ab", () => {
    expect(validateAnnualRoutine("manual", { schedule_kind: "annual" }, [{ type: "run_annual_routine", taskAssignees: "user1,user2" }])).not.toBeNull();
  });
  it("ordnet die Jahresroutine dem richtigen Monat zu", () => {
    expect(routineMonth({ trigger_config: { month: "11" }, actions: [{ type: "run_annual_routine" }] })).toBe(11);
    expect(routineMonth({ trigger_config: { month: "11" }, actions: [{ type: "create_task" }] })).toBeNull();
  });
  it("erhält alte Jahresaufgabenlinks im gemeinsamen Bereich", () => {
    const params = normalizeAutomationParams(new URLSearchParams("adminSection=automation&adminSubSection=annual"));
    expect(params.get("adminSubSection")).toBe("rules");
    expect(automationTabFromParams(params)).toBe("annual");
  });
  it("liefert editierbare Mandatsvorlagen als Jahresroutinen", () => {
    const template = RULE_TEMPLATES.find(item => item.id === "annual-budget");
    expect(template?.actions[0].type).toBe("run_annual_routine");
    expect(template && "schedule" in template ? template.schedule.month : null).toBe("9");
  });
});