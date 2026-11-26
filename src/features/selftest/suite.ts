import type { ScenarioRunState, TestScenario } from "./types";

/**
 * Lädt registrierte Szenarien zu IDs. Unbekannte IDs fallen weg, damit ein
 * Aufrufer mit veralteter Liste nicht gegen die Registry läuft.
 */
export async function loadScenarioSuite(scenarioIds: string[]): Promise<TestScenario[]> {
  const { SELFTEST_SCENARIOS } = await import("./registry");
  const scenarios: TestScenario[] = [];
  for (const id of scenarioIds) {
    const scenario = SELFTEST_SCENARIOS.find((entry) => entry.id === id);
    if (scenario) scenarios.push(scenario);
  }
  return scenarios;
}

/** Führt Szenarien nacheinander aus und speichert jeden Lauf im Mandanten. */
export async function runAndSaveScenarioSuite(
  scenarios: TestScenario[],
  options: {
    tenantId: string;
    userId: string;
    keepData: boolean;
    signal?: AbortSignal;
    onUpdate?: (state: ScenarioRunState) => void;
  },
): Promise<ScenarioRunState[]> {
  const [{ runSuite }, { saveRun }] = await Promise.all([import("./runner"), import("./history")]);
  const results = await runSuite(scenarios, {
    tenantId: options.tenantId,
    userId: options.userId,
    keepData: options.keepData,
    signal: options.signal,
    onUpdate: options.onUpdate ?? (() => undefined),
  });
  for (const result of results) {
    const scenario = scenarios.find((entry) => entry.id === result.scenarioId);
    if (scenario) {
      await saveRun(result, {
        tenantId: options.tenantId,
        userId: options.userId,
        title: scenario.title,
        keepData: options.keepData,
      });
    }
  }
  return results;
}
