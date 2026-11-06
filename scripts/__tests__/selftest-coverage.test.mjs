import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collectCoverage, renderCoverage } from '../check-selftest-coverage.mjs';

function fixture(t, { registered = true, touches = ['tasks'] } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'selftest-coverage-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const write = (path, source) => { mkdirSync(join(root, path, '..'), { recursive: true }); writeFileSync(join(root, path), source); };
  write('src/integrations/supabase/types.ts', 'export type Database = { public: { Tables: { tasks: { Row: {} }; notes: { Row: {} }; settings: { Row: {} }; new_table: { Row: {} } } } }');
  write('src/features/selftest/coverage-config.ts', '/* "new_table" in Kommentar darf nicht als Ausnahme zählen. */ export const IGNORED_TABLES: string[] = ["settings"]; export const DEFERRED_TABLES: string[] = ["notes"];');
  write('src/features/selftest/scenarios/tasks.ts', `// id: "fake-id"\nexport const tasks = { id: 'task-flow', title: 'Aufgaben', touches: ${JSON.stringify(touches)}, features: ['tasks'], writes: [{ table: 'tasks', columns: ['status'] }], steps: [] };`);
  write('src/features/selftest/registry.ts', `import { tasks } from './scenarios/tasks'; export const SELFTEST_SCENARIOS = [${registered ? 'tasks' : ''}];`);
  return root;
}
test('zählt ausgenommene und ausstehende Tabellen nicht als geprüft', t => {
  const report = collectCoverage(fixture(t));
  assert.deepEqual(report.counts, { total: 4, scenario: 1, deferred: 1, excluded: 1, missing: 1 });
  assert.equal(report.scenarios[0].id, 'task-flow');
  assert.deepEqual(report.scenarios[0].writes, [{ table: 'tasks', columns: ['status'] }]);
  assert.ok(report.errors.some(e => e.includes('new_table')));
  assert.match(renderCoverage(report), /keine erfolgreichen Testläufe/);
});
test('ein nicht registriertes Szenario liefert keine Abdeckung', t => {
  const report = collectCoverage(fixture(t, { registered: false }));
  assert.equal(report.counts.scenario, 0);
  assert.ok(report.errors.some(e => e.includes('Nicht registriertes Szenario')));
});
test('verweigert deklarierte Tabellen außerhalb des aktuellen Schemas', t => {
  const report = collectCoverage(fixture(t, { touches: ['invented_table'] }));
  assert.ok(report.errors.some(e => e.includes('Unbekannte Tabelle invented_table')));
});
