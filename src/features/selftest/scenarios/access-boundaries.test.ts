import { describe, expect, it } from "vitest";
import { accessBoundariesScenario } from "./access-boundaries";
import type { TestContext } from "../types";

describe("Zugriffsschutz-Selbsttest", () => {
  it("prüft die aktive Mandantenfilterung als reine Logik", async () => {
    const step = accessBoundariesScenario.steps.find((candidate) => candidate.id === "active-tenant-query-guard");
    expect(step?.kind).toBe("logic");
    const result = await step!.run({} as TestContext);
    expect(result.ok, result.message).toBe(true);
  });
});
