import { expect, it } from "vitest";
import { daySlipLifecycleScenario } from "./day-slip-lifecycle";
import { appendEntries, carryLines, collectCarryLines, emptyDay } from "@/components/dayslip/daySlipState";
import { testDay } from "../fixtures";
import type { TestContext } from "../types";

it("führt die Tageszettel-Regeln im Selbsttest als reine Logik aus", async () => {
  const runId = "11111111-2222-4333-8444-555555555555";
  const firstDay = testDay(runId);
  const secondDay = testDay(runId, 1);
  const store = { [firstDay]: appendEntries(emptyDay(), [{ id: "line-1", text: "Call back" }]) };
  const carriedStore = carryLines(store, secondDay, collectCarryLines(store, secondDay));
  const ctx = { runId, data: { carriedStore } } as unknown as TestContext;

  const steps = daySlipLifecycleScenario.steps.filter((step) => step.kind === "logic");
  expect(steps.length).toBeGreaterThanOrEqual(5);
  for (const step of steps) {
    expect((await step.run(ctx)).ok).toBe(true);
  }
  expect(daySlipLifecycleScenario.steps.some((step) => step.kind !== "logic")).toBe(true);
});
