#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';

const CODE_EXT = /\.(?:[cm]?[jt]sx?)$/;
const ANY_TOKEN = /:\s*any\b|\bas\s+any\b|<\s*any\s*>|\bany\s*\[\s*\]|\bMap\s*<\s*string\s*,\s*any\s*>/;

const ADAPTER_HINTS = [/\/adapters\//i, /\/interop\//i, /InteropAdapter/i, /Adapter\./i, /^src\/services\//i];
const UI_HOOKS_HINTS = [/^src\/components\//, /^src\/pages\//, /^src\/hooks\//];

function sh(cmd) {
  return execSync(cmd, { encoding: 'utf8' }).trim();
}

function isAdapter(file) {
  return ADAPTER_HINTS.some((r) => r.test(file));
}

function isUiHooks(file) {
  return UI_HOOKS_HINTS.some((r) => r.test(file));
}

function classify(file, line) {
  const hasInteropMarker = /INTEROP-ANY|any-exception|any-allow|eslint-disable-next-line\s+@typescript-eslint\/no-explicit-any/i.test(line);

  if (isAdapter(file) && hasInteropMarker) return 'interop-boundary';
  if (isUiHooks(file)) return 'removable-ui-hooks';
  if (isAdapter(file)) return 'removable-adapter-missing-marker';
  return 'removable-non-adapter';
}

const files = sh('rg --files src scripts vite.config.ts').split('\n').filter((f) => CODE_EXT.test(f));

const rows = [];
for (const file of files) {
  let text = '';
  try {
    text = readFileSync(resolve(file), 'utf8');
  } catch {
    continue;
  }
  const lines = text.split('\n');
  lines.forEach((line, index) => {
    if (!ANY_TOKEN.test(line)) return;
    rows.push({ file, line: index + 1, class: classify(file, line), snippet: line.trim() });
  });
}

const summary = rows.reduce((acc, row) => {
  acc[row.class] = (acc[row.class] || 0) + 1;
  return acc;
}, {});

console.log('# any-Klassifizierung');
console.log('');
Object.entries(summary)
  .sort((a, b) => b[1] - a[1])
  .forEach(([klass, count]) => {
    console.log(`- ${klass}: ${count}`);
  });

console.log('');
console.log('| Klasse | Datei | Zeile | Treffer |');
console.log('| --- | --- | ---: | --- |');
for (const row of rows) {
  const snippet = row.snippet.replace(/\|/g, '\\|');
  console.log(`| ${row.class} | ${row.file} | ${row.line} | ${snippet} |`);
}
