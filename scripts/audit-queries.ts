#!/usr/bin/env bun
/**
 * Egress-Audit: scannt src/ nach Anti-Patterns die Datentransfer aufblasen.
 *
 * Findet:
 *   - select('*') ohne explizite Spaltenliste
 *   - .from(table).select(...) ohne .limit() in Listen-Kontexten
 *   - useQuery({...}) ohne staleTime
 *   - supabase.channel(...).on('postgres_changes', {...}) ohne filter
 *
 * Aufruf: bun scripts/audit-queries.ts [--json] [--top=20]
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(import.meta.dir, "..", "src");
const args = new Set(process.argv.slice(2));
const asJson = args.has("--json");
const topArg = [...args].find((a) => a.startsWith("--top="));
const TOP = topArg ? parseInt(topArg.split("=")[1], 10) : 30;

type Rule =
  | "select-star"
  | "no-limit"
  | "no-stale-time"
  | "realtime-no-filter"
  | "count-without-head"
  | "no-range-pagination"
  | "effect-without-cleanup";

type Finding = {
  file: string;
  line: number;
  rule: Rule;
  snippet: string;
};

const findings: Finding[] = [];

function walk(dir: string) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === "node_modules" || entry === "dist" || entry === ".git") continue;
      walk(full);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      scan(full);
    }
  }
}

function scan(file: string) {
  const text = readFileSync(file, "utf8");
  const lines = text.split("\n");
  const rel = relative(join(import.meta.dir, ".."), file);

  lines.forEach((line, i) => {
    const ln = i + 1;
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("*")) return;

    // 1. select('*')
    if (/\.select\(\s*['"`]\*['"`]\s*[,)]/.test(line)) {
      findings.push({ file: rel, line: ln, rule: "select-star", snippet: trimmed.slice(0, 120) });
    }

    // 2. .from(...).select(...) ohne .limit/.maybeSingle/.single in den nächsten 8 Zeilen
    const fromMatch = /\.from\(['"`]([a-z_]+)['"`]\)/.exec(line);
    if (fromMatch) {
      const window = lines.slice(i, i + 10).join("\n");
      const isSingleish = /\.maybeSingle\(\)|\.single\(\)|\.limit\(|\.eq\(['"`](id|user_id)['"`]/i.test(
        window,
      );
      if (!isSingleish && /\.select\(/.test(window)) {
        findings.push({
          file: rel,
          line: ln,
          rule: "no-limit",
          snippet: trimmed.slice(0, 120),
        });
      }
    }

    // 3. useQuery({...}) ohne staleTime im Block (heuristisch: nächste 25 Zeilen)
    if (/\buseQuery\s*\(\s*\{/.test(line)) {
      const window = lines.slice(i, i + 30).join("\n");
      if (!/staleTime\s*:/.test(window)) {
        findings.push({
          file: rel,
          line: ln,
          rule: "no-stale-time",
          snippet: trimmed.slice(0, 120),
        });
      }
    }

    // 4. postgres_changes ohne filter
    if (/'postgres_changes'/.test(line) || /"postgres_changes"/.test(line)) {
      const window = lines.slice(Math.max(0, i - 2), i + 15).join("\n");
      if (!/filter\s*:/.test(window)) {
        findings.push({
          file: rel,
          line: ln,
          rule: "realtime-no-filter",
          snippet: trimmed.slice(0, 120),
        });
      }
    }

    // 5. count: 'exact' ohne head: true (lädt unnötig Zeilen)
    if (/count:\s*['"`]exact['"`]/.test(line)) {
      const window = lines.slice(Math.max(0, i - 1), i + 4).join("\n");
      if (!/head:\s*true/.test(window)) {
        findings.push({
          file: rel,
          line: ln,
          rule: "count-without-head",
          snippet: trimmed.slice(0, 120),
        });
      }
    }

    // 6. .order(...) ohne .range() oder .limit() (potenzielle Riesen-Liste)
    if (/\.order\(/.test(line)) {
      const window = lines.slice(Math.max(0, i - 6), i + 6).join("\n");
      if (!/\.range\(|\.limit\(|\.maybeSingle\(|\.single\(/.test(window)) {
        findings.push({
          file: rel,
          line: ln,
          rule: "no-range-pagination",
          snippet: trimmed.slice(0, 120),
        });
      }
    }

    // 7. useEffect mit supabase-Aufruf ohne Cleanup-Return
    if (/\buseEffect\s*\(/.test(line)) {
      const window = lines.slice(i, i + 40).join("\n");
      const hasSupabase = /supabase\.(channel|from|auth\.onAuthStateChange)/.test(window);
      const hasCleanup = /return\s*\(\s*\)\s*=>|return\s+function/.test(window);
      if (hasSupabase && !hasCleanup) {
        findings.push({
          file: rel,
          line: ln,
          rule: "effect-without-cleanup",
          snippet: trimmed.slice(0, 120),
        });
      }
    }
  });
}

walk(ROOT);

// Aggregation pro Datei
const byFile = new Map<string, number>();
for (const f of findings) byFile.set(f.file, (byFile.get(f.file) ?? 0) + 1);

const byRule = new Map<string, number>();
for (const f of findings) byRule.set(f.rule, (byRule.get(f.rule) ?? 0) + 1);

if (asJson) {
  console.log(JSON.stringify({ findings, byFile: Object.fromEntries(byFile), byRule: Object.fromEntries(byRule) }, null, 2));
  process.exit(0);
}

console.log("\n=== Egress-Audit ===\n");
console.log("Gesamt:", findings.length, "Findings\n");

console.log("Pro Regel:");
for (const [rule, count] of [...byRule.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${rule.padEnd(22)} ${count}`);
}

console.log(`\nTop ${TOP} Dateien:`);
const top = [...byFile.entries()].sort((a, b) => b[1] - a[1]).slice(0, TOP);
for (const [file, count] of top) {
  console.log(`  ${String(count).padStart(4)}  ${file}`);
}

console.log("\nDetails: bun scripts/audit-queries.ts --json | jq '.findings[:20]'");
