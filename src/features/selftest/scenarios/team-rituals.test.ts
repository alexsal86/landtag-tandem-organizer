import { expect, it } from "vitest";
import type { TestContext } from "../types";
import { teamRitualsScenario } from "./team-rituals";

it("öffnet den Dashboard-Einstieg im Team-Rituale-Tab, ohne fremde Tab-Parameter umzuschreiben", async () => {
  const step = teamRitualsScenario.steps.find((candidate) => candidate.id === "ritual-deeplink");
  expect(step).toBeDefined();
  expect(await step!.run({} as TestContext)).toMatchObject({ ok: true });
});
