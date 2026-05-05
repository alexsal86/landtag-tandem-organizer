#!/usr/bin/env node
/**
 * Selbsttest-Coverage-Check.
 *
 * - Liest alle Tabellen aus dem Snapshot src/features/selftest/__schema-snapshot__/public-tables.json
 * - Liest IGNORED_TABLES aus src/features/selftest/coverage-config.ts (regex-extrahiert)
 * - Scannt src/features/selftest/scenarios/*.ts auf `touches: [...]`-Arrays
 * - Schreibt docs/selftest-coverage.md
 * - Exit 1, wenn nicht-ignorierte Tabellen ohne Szenario existieren.
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const SNAPSHOT = join(ROOT, "src/features/selftest/__schema-snapshot__/public-tables.json");
const CONFIG = join(ROOT, "src/features/selftest/coverage-config.ts");
const SCENARIOS_DIR = join(ROOT, "src/features/selftest/scenarios");
const DOC_OUT = join(ROOT, "docs/selftest-coverage.md");

const tables = JSON.parse(readFileSync(SNAPSHOT, "utf8"));
const cfg = readFileSync(CONFIG, "utf8");
const ignored = new Set(
  Array.from(cfg.matchAll(/"([a-z_0-9]+)"/g)).map((m) => m[1]),
);

const coverage = new Map(); // table -> [scenarioId]
const columnCoverage = new Map(); // table -> Set(columns) tested
const scenarioMeta = []; // {id, title, touches, features, writes, file}
for (const f of readdirSync(SCENARIOS_DIR).filter((n) => n.endsWith(".ts"))) {
  const src = readFileSync(join(SCENARIOS_DIR, f), "utf8");
  const id = (src.match(/id:\s*"([^"]+)"/) || [])[1] ?? f;
  const title = (src.match(/title:\s*"([^"]+)"/) || [])[1] ?? id;
  const touchesMatch = src.match(/touches:\s*\[([^\]]*)\]/);
  const featuresMatch = src.match(/features:\s*\[([^\]]*)\]/);
  const touches = touchesMatch
    ? Array.from(touchesMatch[1].matchAll(/"([^"]+)"/g)).map((m) => m[1])
    : [];
  const features = featuresMatch
    ? Array.from(featuresMatch[1].matchAll(/"([^"]+)"/g)).map((m) => m[1])
    : [];
  // Extract writes: [...] block (multi-line)
  const writes = [];
  const writesMatch = src.match(/writes:\s*\[([\s\S]*?)\n\s*\],/);
  if (writesMatch) {
    for (const entry of writesMatch[1].matchAll(/\{\s*table:\s*"([^"]+)"\s*,\s*columns:\s*\[([^\]]*)\]\s*\}/g)) {
      const table = entry[1];
      const cols = Array.from(entry[2].matchAll(/"([^"]+)"/g)).map((m) => m[1]);
      writes.push({ table, columns: cols });
      if (!columnCoverage.has(table)) columnCoverage.set(table, new Set());
      cols.forEach((c) => columnCoverage.get(table).add(c));
    }
  }
  scenarioMeta.push({ id, title, touches, features, writes, file: f });
  for (const t of touches) {
    if (!coverage.has(t)) coverage.set(t, []);
    coverage.get(t).push(id);
  }
}

const missing = tables.filter((t) => !ignored.has(t) && !coverage.has(t));

let md = `# Selbsttest-Coverage\n\n_Auto-generiert von \`scripts/check-selftest-coverage.mjs\`. Nicht von Hand bearbeiten._\n\n`;
md += `## Szenarien\n\n| ID | Titel | Features | Tabellen |\n|---|---|---|---|\n`;
for (const s of scenarioMeta.sort((a, b) => a.id.localeCompare(b.id))) {
  md += `| \`${s.id}\` | ${s.title} | ${s.features.join(", ") || "—"} | ${s.touches.join(", ") || "—"} |\n`;
}
md += `\n## Tabellen-Coverage\n\n| Tabelle | Status | Szenario(en) |\n|---|---|---|\n`;
for (const t of tables) {
  const cov = coverage.get(t);
  const status = cov ? "✅ getestet" : ignored.has(t) ? "⚪ ignoriert" : "❌ FEHLT";
  md += `| \`${t}\` | ${status} | ${cov ? cov.join(", ") : "—"} |\n`;
}
md += `\n## Lücken\n\n`;
md += missing.length
  ? missing.map((t) => `- \`${t}\``).join("\n") + "\n"
  : "_Keine — alle relevanten Tabellen sind abgedeckt._\n";

writeFileSync(DOC_OUT, md);

console.log(`[selftest-coverage] Szenarien: ${scenarioMeta.length}`);
console.log(`[selftest-coverage] Tabellen gesamt: ${tables.length}`);
console.log(`[selftest-coverage] Abgedeckt: ${coverage.size}, ignoriert: ${ignored.size}, FEHLT: ${missing.length}`);
console.log(`[selftest-coverage] Doc geschrieben: ${DOC_OUT}`);

if (missing.length > 0) {
  console.error(`\nFehlende Coverage für:\n${missing.map((t) => "  - " + t).join("\n")}`);
  console.error(`\nLösung: Szenario in src/features/selftest/scenarios/ ergänzen ODER Tabelle in coverage-config.ts in IGNORED_TABLES aufnehmen.`);
  process.exit(1);
}
