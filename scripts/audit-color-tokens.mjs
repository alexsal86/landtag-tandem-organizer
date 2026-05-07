#!/usr/bin/env node
/**
 * Scans src/ for hardcoded Tailwind color classes that violate the
 * design-token rule. Use semantic tokens (text-foreground, bg-muted,
 * border-primary, ...) instead of literal color names.
 *
 * Run: node scripts/audit-color-tokens.mjs
 *      node scripts/audit-color-tokens.mjs --top 20
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const SRC = "src";
const PATTERN =
  /\b(text|bg|border|ring|fill|stroke|from|via|to|divide|placeholder|caret|accent|outline|decoration|shadow)-(white|black|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(-\d{2,3})?\b/g;

const fileHits = new Map();

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) {
      if (!/node_modules|\.next|dist|build|coverage/.test(p)) walk(p);
    } else if (/\.(ts|tsx|jsx|js)$/.test(p)) {
      const text = readFileSync(p, "utf8");
      const matches = text.match(PATTERN);
      if (matches) fileHits.set(p, matches.length);
    }
  }
}

walk(SRC);

const sorted = [...fileHits.entries()].sort((a, b) => b[1] - a[1]);
const total = sorted.reduce((acc, [, n]) => acc + n, 0);
const topArg = process.argv.indexOf("--top");
const limit = topArg !== -1 ? Number(process.argv[topArg + 1]) || 20 : sorted.length;

console.log(`\nHardcoded Tailwind color classes (top ${Math.min(limit, sorted.length)})`);
console.log("--------------------------------------------------------------");
sorted.slice(0, limit).forEach(([file, n]) => {
  console.log(String(n).padStart(5), file);
});
console.log("--------------------------------------------------------------");
console.log(`Total: ${total} occurrences in ${sorted.length} files\n`);

// Exit code 0 always — informational. CI can wrap with a budget if needed.
