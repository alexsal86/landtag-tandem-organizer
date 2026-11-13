import { expect, it } from "vitest";
import { responsibilitiesScenario } from "./responsibilities";
import type { TestContext } from "../types";
it("führt die Matrixregeln im Selbsttest als reine Logik aus", async () => {
  const steps = responsibilitiesScenario.steps.filter(
    (s) => s.kind === "logic",
  );
  expect(steps.length).toBeGreaterThanOrEqual(3);
  for (const step of steps)
    expect((await step.run({} as TestContext)).ok).toBe(true);
  expect(responsibilitiesScenario.steps.some((s) => s.kind === "db")).toBe(
    true,
  );
});
