import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collectReport, listFunctions, parseTableColumns, renderReport } from '../check-edge-function-columns.mjs';

function fixture(t, { functions = {}, tables = { letters: ['id', 'status', 'sent_at'] } }) {
  const root = mkdtempSync(join(tmpdir(), 'edge-function-columns-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const write = (path, source) => {
    mkdirSync(join(root, path, '..'), { recursive: true });
    writeFileSync(join(root, path), source);
  };
  const rows = Object.entries(tables)
    .map(([table, columns]) => `${table}: { Row: { ${columns.map(column => `${column}: string`).join('; ')} }; Insert: {}; Update: {} }`)
    .join('; ');
  write('src/integrations/supabase/types.ts', `export type Database = { public: { Tables: { ${rows} }; Functions: {}; Enums: {} } }`);
  for (const [name, source] of Object.entries(functions)) write(`supabase/functions/${name}/index.ts`, source);
  return root;
}

test('liest die Spalten aus dem Row-Block der generierten Typen', () => {
  const tables = parseTableColumns('export type Database = { public: { Tables: { letters: { Row: { id: string; status: string }; Insert: {} } } } }');
  assert.deepEqual([...tables.get('letters')], ['id', 'status']);
});

test('meldet eine Spalte, die es in der Tabelle nicht gibt', t => {
  const root = fixture(t, {
    functions: {
      'archive-letter': `
        await supabase.from('letters').update({ status: 'sent', archived_at: now, archived_by: user }).eq('id', id);
        await supabase.from('letters').insert({ id, status: 'draft' });
      `,
    },
  });
  const report = collectReport(root, ['archive-letter']);
  assert.deepEqual(report.violations.map(({ table, method, column }) => `${table}.${method}.${column}`), [
    'letters.update.archived_at',
    'letters.update.archived_by',
  ]);
  assert.match(renderReport(report), /unbekannte Spalte "archived_at"/);
});

test('lässt vorhandene Spalten, dynamische Zeilen und unbekannte Tabellen durch', t => {
  const root = fixture(t, {
    functions: {
      'archive-letter': `
        await supabase.from('letters').update({ status: 'sent', sent_at: now }).eq('id', id);
        await supabase.from('letters').insert(payload);
        await supabase.from('other_table').insert({ anything: 1 });
      `,
    },
  });
  assert.deepEqual(collectReport(root, ['archive-letter']).violations, []);
});

test('prüft ausschließlich die übergebene Auswahl', t => {
  const root = fixture(t, {
    functions: {
      'archive-letter': `await supabase.from('letters').update({ status: 'sent' });`,
      'other-function': `await supabase.from('letters').update({ archived_at: now });`,
    },
  });
  assert.deepEqual(collectReport(root, ['archive-letter']).violations, []);
  assert.equal(collectReport(root, ['other-function']).violations.length, 1);
});

test('ohne Auswahl prüft der Check alle Funktionen des Verzeichnisses', t => {
  const root = fixture(t, {
    functions: {
      'archive-letter': `await supabase.from('letters').update({ status: 'sent' });`,
      'other-function': `await supabase.from('letters').update({ archived_at: now });`,
      '_shared': `export const helper = 1;`,
    },
  });
  assert.deepEqual(listFunctions(root), ['_shared', 'archive-letter', 'other-function'].filter(name => name !== '_shared'));
  assert.deepEqual(collectReport(root).violations.map(v => `${v.table}.${v.column}`), ['letters.archived_at']);
});

test('meldet eine gelistete Funktion, die es nicht gibt', t => {
  const root = fixture(t, { functions: {} });
  assert.equal(collectReport(root, ['archive-letter']).violations[0].column, 'Funktion nicht gefunden');
});
