import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collectReport, listFunctions, parseTableColumns, renderReport } from '../check-edge-function-columns.mjs';

function fixture(t, { functions = {}, shared = {}, tables = { letters: ['id', 'status', 'sent_at'] } }) {
  const root = mkdtempSync(join(tmpdir(), 'edge-function-columns-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const write = (path, source) => {
    mkdirSync(join(root, path, '..'), { recursive: true });
    writeFileSync(join(root, path), source);
  };
  // Spalten dürfen als Liste (nur Row) oder als { row, required } angegeben werden.
  const rows = Object.entries(tables)
    .map(([table, spec]) => {
      const columns = Array.isArray(spec) ? spec : spec.row;
      const required = Array.isArray(spec) ? [] : (spec.required ?? []);
      const row = columns.map(column => `${column}: string`).join('; ');
      const insert = columns
        .map(column => `${column}${required.includes(column) ? '' : '?'}: string`)
        .join('; ');
      return `${table}: { Row: { ${row} }; Insert: { ${insert} }; Update: {} }`;
    })
    .join('; ');
  write('src/integrations/supabase/types.ts', `export type Database = { public: { Tables: { ${rows} }; Functions: {}; Enums: {} } }`);
  for (const [name, source] of Object.entries(functions)) write(`supabase/functions/${name}/index.ts`, source);
  for (const [name, source] of Object.entries(shared)) write(`supabase/functions/_shared/${name}`, source);
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

test('prüft geteilte Module mit, wenn keine Auswahl vorgegeben ist', t => {
  const root = fixture(t, {
    functions: { 'plain': `export const nothing = 1;` },
    shared: {
      'seed.ts': `
        export async function seed(admin) {
          await admin.from('letters').insert({ id, status: 'draft', archived_at: now });
        }
      `,
    },
  });
  const report = collectReport(root);
  assert.equal(report.sharedFiles.length, 1);
  assert.deepEqual(report.violations.map(({ table, column }) => `${table}.${column}`), ['letters.archived_at']);
});

test('meldet fehlende Pflichtspalten beim Insert, nicht beim Update', t => {
  const root = fixture(t, {
    functions: {
      'f': `
        await supabase.from('letters').insert({ id });
        await supabase.from('letters').update({ id }).eq('id', id);
      `,
    },
    tables: { letters: { row: ['id', 'status'], required: ['status'] } },
  });
  assert.deepEqual(collectReport(root, ['f']).violations.map(v => `${v.kind}:${v.column}`), ['pflicht:status']);
  assert.equal(renderReport(collectReport(root, ['f'])).includes('ohne Pflichtspalte "status"'), true);
});

test('prüft safeInsert-Zeilen samt Spread aus einer Konstante derselben Datei', t => {
  const root = fixture(t, {
    functions: {
      'seed': `
        const TYPES = [{ name: 'A', description: 'B' }];
        await safeInsert(admin, 'letters', TYPES.map((entry, index) => ({ ...entry, id, status: 'draft', order_index: index })), report, 'letters');
      `,
    },
    tables: { letters: ['id', 'status', 'name', 'order_index'] },
  });
  assert.deepEqual(collectReport(root, ['seed']).violations.map(({ table, column }) => `${table}.${column}`), ['letters.description']);
});

test('erfüllt Pflichtspalten über Spread aus einer Konstante', t => {
  const root = fixture(t, {
    functions: {
      'seed': `
        const TEMPLATES = [{ name: 'Jour Fixe' }];
        await safeInsert(admin, 'letters', TEMPLATES.map(item => ({ ...item, id: 'x', status: 'draft' })), report, 'letters');
      `,
    },
    tables: { letters: { row: ['id', 'status', 'name'], required: ['id', 'status', 'name'] } },
  });
  assert.deepEqual(collectReport(root, ['seed']).violations, []);
});

test('leere Konstanten liefern keine Spalten: Warnung statt falscher Pflichtspalte', t => {
  const root = fixture(t, {
    functions: {
      'anomaly': `
        const rows = [];
        rows.push({ id: 'a', status: 'draft' });
        await safeInsert(admin, 'letters', rows.map(row => ({ ...row })), report, 'letters');
      `,
    },
    tables: { letters: { row: ['id', 'status'], required: ['id', 'status'] } },
  });
  const report = collectReport(root, ['anomaly']);
  assert.deepEqual(report.violations, []);
  assert.ok(report.warnings.some(warning => warning.message.includes('nicht prüfbar')));
});

test('meldet einen nicht registrierten Aufgabenstatus', t => {
  const root = fixture(t, {
    functions: { 'f': `await supabase.from('tasks').insert({ id, status: 'open' });` },
    tables: { tasks: ['id', 'status'] },
  });
  const report = collectReport(root, ['f']);
  assert.deepEqual(report.violations.map(v => `${v.kind}:${v.column}`), ['status:open']);
  assert.equal(renderReport(report).includes('nicht registrierten Status "open"'), true);
});

test('prüft Status in aufgelösten Zeilen (map/Spread, safeInsert) und lässt andere Tabellen in Ruhe', t => {
  const root = fixture(t, {
    functions: {
      'f': `
        const ROWS = [{ id }];
        await safeInsert(admin, 'tasks', ROWS.map(row => ({ ...row, status: 'open' })), report, 'tasks');
        await supabase.from('task_decisions').insert({ id, status: 'open' });
      `,
    },
    tables: { tasks: ['id', 'status'], task_decisions: ['id', 'status'] },
  });
  assert.deepEqual(collectReport(root, ['f']).violations.map(v => `${v.table}:${v.column}`), ['tasks:open']);
});

test('akzeptiert registrierte Kernstatus', t => {
  const root = fixture(t, {
    functions: {
      'f': `
        await supabase.from('tasks').insert({ id, status: 'in_progress' });
        await supabase.from('tasks').insert({ id, status: 'review' });
      `,
    },
    tables: { tasks: ['id', 'status'] },
  });
  assert.deepEqual(collectReport(root, ['f']).violations, []);
});

test('Kernstatus des Checkers stimmt mit src/components/tasks/types.ts überein', async () => {
  const { readFileSync } = await import('node:fs');
  const { CORE_TASK_STATUS_KEYS } = await import('../check-edge-function-columns.mjs');
  const types = readFileSync(new URL('../../src/components/tasks/types.ts', import.meta.url), 'utf8');
  const match = /export const CORE_TASK_STATUS_KEYS = \[([^\]]+)\]/.exec(types);
  assert.ok(match, 'Konstante im Frontend nicht gefunden');
  const frontend = match[1].split(',').map(entry => entry.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
  assert.deepEqual(frontend, [...CORE_TASK_STATUS_KEYS]);
});
