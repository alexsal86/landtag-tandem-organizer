import { it, expect } from "vitest";
import {
  responsibilityCoverage,
  matchesResponsibilityArea,
  type Responsibility,
} from "./suggest";
const area = { id: "presse", kind: "topic" as const, name: "Presse" };
const rows: Responsibility[] = [
  { user_id: "anna", kind: "topic", topic_id: "presse", level: "primary" },
  { user_id: "ben", kind: "topic", topic_id: "presse", level: "primary" },
];
it("erlaubt mehrere Primärpersonen, ohne die bisherigen Zuordnungen zu verändern", () => {
  expect(responsibilityCoverage(area, rows)).toEqual({
    primary: 2,
    secondary: 0,
    state: "covered",
  });
  expect(rows.every((r) => r.level === "primary")).toBe(true);
});
it("unterscheidet fehlende Primärzuständigkeit von vollständig unbesetzten Bereichen", () => {
  expect(
    responsibilityCoverage(area, [{ ...rows[0], level: "secondary" }]).state,
  ).toBe("no_primary");
  expect(responsibilityCoverage(area, []).state).toBe("unassigned");
});
it("sucht nach Bereich und zugeordneter Person unabhängig von Großschreibung", () => {
  const people = [
    { id: "anna", name: "Anna" },
    { id: "ben", name: "Ben" },
  ];
  expect(matchesResponsibilityArea(area, " PRESSE ", rows, people)).toBe(true);
  expect(matchesResponsibilityArea(area, "anna", rows, people)).toBe(true);
  expect(matchesResponsibilityArea(area, "Carla", rows, people)).toBe(false);
});
