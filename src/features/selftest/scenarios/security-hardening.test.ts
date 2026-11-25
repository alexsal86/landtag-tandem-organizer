import { expect, it } from "vitest";
import { runScenario } from "../runner";
import { securityHardeningScenario } from "./security-hardening";

it("prüft Porträt- und E-Mail-Regeln mit den geteilten Sicherheitsfunktionen", async () => {
  const result = await runScenario(securityHardeningScenario, { tenantId: "", userId: "", onUpdate: () => {} });
  expect(result.steps.filter((step) => step.status !== "ok")
    .map((step) => `${step.step.label}: ${step.message}`)).toEqual([]);
  expect(result.status).toBe("ok");
});
