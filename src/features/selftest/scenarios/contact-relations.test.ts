import { expect, it } from "vitest";
import { contactRelationsScenario } from "./contact-relations";
import type { TestContext } from "../types";

it("führt die Importregeln als reine Logik aus (CSV, Semikolon, VCF, Zeilenprüfung)", async () => {
  const ctx = {
    runId: "11111111-2222-4333-8444-555555555555",
    data: {},
  } as unknown as TestContext;

  const steps = contactRelationsScenario.steps.filter((step) => step.kind === "logic");
  expect(steps.length).toBeGreaterThanOrEqual(1);

  for (const step of steps) {
    const result = await step.run(ctx);
    expect(result.ok, `${step.id}: ${result.message}`).toBe(true);
  }
});
