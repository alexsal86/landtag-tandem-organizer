import { onboardingHrScenario } from "@/features/selftest/scenarios/onboarding-hr";
import type { TestContext } from "@/features/selftest/types";
import { describe, it, expect } from "vitest";
import {
  hrDueDay,
  hrProgress,
  overdueMandatory,
  upcomingDeparture,
  canViewHr,
} from "./progress";
import {
  HR_DEFAULT_TEMPLATES,
  hrEditorFields,
  hrStepsFromEditor,
} from "./templates";
describe("HR-Regeln", () => {
  it("führt die im Selbsttest-Center registrierten Logikschritte aus", async () => {
    for (const step of onboardingHrScenario.steps.filter(
      (s) => s.kind === "logic",
    ))
      expect((await step.run({} as TestContext)).ok).toBe(true);
  });
  it("zählt Kalendertage über Monats- und Jahresgrenzen", () => {
    expect(hrDueDay("2026-12-20", 14)).toBe("2027-01-03");
    expect(hrDueDay("2026-01-05", -7)).toBe("2025-12-29");
    expect(() => hrDueDay("2026-02-30", 0)).toThrow();
  });
  it("trennt Pflicht und optional und behandelt den heutigen Tag nicht als überfällig", () => {
    const items = [
      {
        id: "a",
        is_mandatory: true,
        status: "completed",
        due_day: "2026-11-01",
      },
      { id: "b", is_mandatory: true, status: "waiting", due_day: "2026-11-12" },
      { id: "c", is_mandatory: false, status: "active", due_day: "2026-11-01" },
      { id: "d", is_mandatory: true, status: "active", due_day: "2026-11-13" },
    ];
    expect(hrProgress(items)).toEqual({
      mandatory: { done: 1, total: 3, percent: 33 },
      optional: { done: 0, total: 1, percent: 0 },
    });
    expect(
      overdueMandatory(items, "2026-11-01", "2026-11-13").map((i) => i.id),
    ).toEqual(["b"]);
  });
  it("verwendet relative Eintrittsfristen und erkennt Austritte bis einschließlich 30 Tage", () => {
    expect(
      overdueMandatory(
        [{ id: "a", is_mandatory: true, offset_days: 14 }],
        "2026-11-01",
        "2026-11-16",
      ),
    ).toHaveLength(1);
    expect(upcomingDeparture("2026-12-13", "2026-11-13")).toBe(true);
    expect(upcomingDeparture("2026-12-14", "2026-11-13")).toBe(false);
  });
  it("begrenzt persönliche Punkte auf Betroffene und Leitung", () => {
    expect(canViewHr("mitarbeiter", "a", "b")).toBe(false);
    expect(canViewHr("mitarbeiter", "a", "a")).toBe(true);
    expect(canViewHr("bueroleitung", "a", "b")).toBe(true);
  });
  it("erhält Pflichtkennzeichen, Phasen und Nachweisart beim vorhandenen Routinen-Editor", () => {
    for (const template of HR_DEFAULT_TEMPLATES) {
      const fields = hrEditorFields(template.steps);
      expect(
        hrStepsFromEditor(
          fields.value,
          fields.kinds,
          fields.settings,
          fields.metadata,
        ),
      ).toEqual(template.steps);
    }
    expect(
      HR_DEFAULT_TEMPLATES.find(
        (t) => t.direction === "offboarding",
      )?.steps.some((s) => s.evidence === "handover"),
    ).toBe(true);
  });
});
