import coverage from "./coverage-summary.json";

interface CoverageTable {
  table: string;
  status: string;
  scenarios: string[];
}

const scenariosByTable = new Map<string, string[]>(
  (coverage.tables as CoverageTable[]).map((entry) => [entry.table, entry.scenarios]),
);

/**
 * Selbsttest-Szenarien, die eine Tabelle laut Coverage-Übersicht abdecken
 * (`touches` der Szenarien). Leer, wenn kein Szenario die Tabelle prüft –
 * dann gibt es fachlich nichts nachzutesten.
 */
export function retestScenariosForTable(table: string): string[] {
  return scenariosByTable.get(table) ?? [];
}
