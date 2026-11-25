import { expect, it } from "vitest";
import { runScenario } from "../runner";
import { employeeProtectionScenario } from "./employee-protection";

it("prüft Protokoll-, Wohlbefindens- und Vorbereitungsregeln ohne Datenbank", async () => {
  const result = await runScenario(employeeProtectionScenario, { tenantId: "", userId: "", onUpdate: () => {} });
  expect(result.steps.filter((step) => step.status !== "ok")
    .map((step) => `${step.step.label}: ${step.message}`)).toEqual([]);
  expect(result.status).toBe("ok");
});
