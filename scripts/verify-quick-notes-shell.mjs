import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
const directory = process.argv[2] ?? 'dist';
const source = await readFile(path.join(directory, 'quick-notes-shell.js'), 'utf8');
const shell = JSON.parse(source.slice(source.indexOf('=') + 1).trim().replace(/;$/, ''));
assert.match(shell.version, /^[a-f0-9]{16}$/);
assert.ok(shell.assets.includes('/index.html'));
assert.ok(shell.assets.some(file => /MyWorkView.*\.js$/.test(file)));
let bytes = 0;
for (const file of shell.assets) {
  assert.ok(file.startsWith('/') && !file.includes('..') && !file.startsWith('/api/'));
  bytes += (await stat(path.join(directory, file))).size;
}
console.log(`PASS offline shell: ${shell.assets.length} existing assets, ${(bytes / 1024 / 1024).toFixed(1)} MiB`);
