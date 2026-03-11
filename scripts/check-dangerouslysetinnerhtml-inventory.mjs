#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const repoRoot = process.cwd();
const inventoryPath = path.join(repoRoot, 'docs/dangerouslysetinnerhtml-inventory.md');
const inventory = fs.readFileSync(inventoryPath, 'utf8');

const rgOutput = execSync('rg -n "dangerouslySetInnerHTML" src', { encoding: 'utf8' })
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => {
    const [file, lineNo] = line.split(':');
    return `${file}:${lineNo}`;
  });

const docEntries = inventory
  .split(/\r?\n/)
  .filter((line) => line.startsWith('| `src/'))
  .map((line) => {
    const match = line.match(/^\| `([^`]+)` \| (\d+) \|/);
    if (!match) return null;
    return `${match[1]}:${match[2]}`;
  })
  .filter(Boolean);

const docSet = new Set(docEntries);
const rgSet = new Set(rgOutput);

const missingInDoc = rgOutput.filter((entry) => !docSet.has(entry));
const staleInDoc = docEntries.filter((entry) => !rgSet.has(entry));

if (missingInDoc.length || staleInDoc.length) {
  console.error('❌ dangerouslySetInnerHTML inventory drift detected.');
  if (missingInDoc.length) {
    console.error('Missing in docs/dangerouslysetinnerhtml-inventory.md:');
    for (const item of missingInDoc) console.error(` - ${item}`);
  }
  if (staleInDoc.length) {
    console.error('Stale entries in docs/dangerouslysetinnerhtml-inventory.md:');
    for (const item of staleInDoc) console.error(` - ${item}`);
  }
  process.exit(1);
}

console.log(`✅ dangerouslySetInnerHTML inventory is in sync (${rgOutput.length} occurrences checked).`);
