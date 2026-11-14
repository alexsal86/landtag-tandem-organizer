#!/usr/bin/env node
// Reuses the browser's pure rules without maintaining a second set of formulas.
// Input JSON: { results: DistrictResult[], turnout: Turnout[], state: StateResult[] }
import fs from "node:fs";
import ts from "typescript";
if (!process.argv[2]) {
  console.error(
    "Usage: node scripts/validate-election-analysis.mjs snapshot.json",
  );
  process.exit(2);
}
const input = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
for (const key of ["results", "turnout", "state"])
  if (!Array.isArray(input[key])) throw new Error(`Missing array: ${key}`);
const source = fs.readFileSync(
  new URL(
    "../src/features/election-analysis/research/calculations.ts",
    import.meta.url,
  ),
  "utf8",
);
const output = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;
const { validateElectionData } = await import(
  `data:text/javascript;base64,${Buffer.from(output).toString("base64")}`
);
const issues = validateElectionData(input.results, input.turnout, input.state);
console.log(
  JSON.stringify(
    {
      errors: issues.filter((i) => i.severity === "error").length,
      warnings: issues.filter((i) => i.severity === "warning").length,
      issues,
    },
    null,
    2,
  ),
);
process.exitCode = issues.some((i) => i.severity === "error") ? 1 : 0;
