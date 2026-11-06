import { expect, it } from "vitest";
import { runScenario } from "../runner";
import { workflowRulesScenario } from "./workflow-rules";

it("führt die im Center angezeigten Geschäftsregeln mit den tatsächlichen Domänenfunktionen aus", async () => {
  const result = await runScenario(workflowRulesScenario, { tenantId: "", userId: "", onUpdate: () => {} });
  expect(result.steps.map(s => ({ label: s.step.label, status: s.status, message: s.message }))).toEqual(expect.arrayContaining([
    expect.objectContaining({ status: "ok", message: "9/9 Statusregeln bestanden." }),
    expect.objectContaining({ status: "ok", message: "5/5 Rollenregeln bestanden." }),
    expect.objectContaining({ status: "ok", message: "Frist und Wiedervorlage korrekt." }),
  ]));
  expect(result.status).toBe("ok");
});
