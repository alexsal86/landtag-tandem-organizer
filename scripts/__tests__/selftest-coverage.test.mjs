import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collectCoverage, renderCoverage } from '../check-selftest-coverage.mjs';

const TODAY = new Date('2026-11-26T12:00:00Z');
const DEFAULT_CONFIG = `/* "new_table" in Kommentar darf nicht als Ausnahme zählen. */
export const COVERAGE_EXCEPTIONS = [
  { kind: "excluded", reason: "Technische Einstellungstabelle ohne eigenen Workflow.", expiresOn: "2027-06-30", tables: ["settings"] },
  { kind: "deferred", reason: "Eigenes Szenario für Notizen steht noch aus.", expiresOn: "2027-06-30", tables: ["notes"] },
];`;

function fixture(t, { registered = true, touches = ['tasks'], config = DEFAULT_CONFIG, inventory } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'selftest-coverage-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const write = (path, source) => { mkdirSync(join(root, path, '..'), { recursive: true }); writeFileSync(join(root, path), source); };
  write('src/integrations/supabase/types.ts', 'export type Database = { public: { Tables: { tasks: { Row: {} }; notes: { Row: {} }; settings: { Row: {} }; new_table: { Row: {} } } } }');
  write('src/features/selftest/coverage-config.ts', config);
  write('src/features/selftest/scenarios/tasks.ts', `// id: "fake-id"\nexport const tasks = { id: 'task-flow', title: 'Aufgaben', touches: ${JSON.stringify(touches)}, features: ['tasks'], writes: [{ table: 'tasks', columns: ['status'] }], steps: [] };`);
  write('src/features/selftest/registry.ts', `import { tasks } from './scenarios/tasks'; export const SELFTEST_SCENARIOS = [${registered ? 'tasks' : ''}];`);
  if (inventory) write('src/features/feature-catalog/inventory/tasks.json', JSON.stringify(inventory));
  return root;
}

test('zählt Ausnahmen mit Ablaufdatum getrennt und meldet unzugeordnete Tabellen', t => {
  const report = collectCoverage(fixture(t), { today: TODAY });
  assert.deepEqual(report.counts, { total: 4, scenario: 1, deferred: 1, excluded: 1, missing: 1, exceptions: 2 });
  assert.equal(report.scenarios[0].id, 'task-flow');
  assert.deepEqual(report.scenarios[0].writes, [{ table: 'tasks', columns: ['status'] }]);
  assert.equal(report.tables.find(row => row.table === 'settings').exception.expiresOn, '2027-06-30');
  assert.ok(report.errors.some(e => e.includes('new_table')));
  assert.match(renderCoverage(report), /keine erfolgreichen Testläufe/);
  assert.match(renderCoverage(report), /Befristete Ausnahmen/);
  assert.match(renderCoverage(report), /Fachfunktionen ohne Selbsttest/);
});

test('ein nicht registriertes Szenario liefert keine Abdeckung', t => {
  const report = collectCoverage(fixture(t, { registered: false }), { today: TODAY });
  assert.equal(report.counts.scenario, 0);
  assert.ok(report.errors.some(e => e.includes('Nicht registriertes Szenario')));
});

test('verweigert deklarierte Tabellen außerhalb des aktuellen Schemas', t => {
  const report = collectCoverage(fixture(t, { touches: ['invented_table'] }), { today: TODAY });
  assert.ok(report.errors.some(e => e.includes('Unbekannte Tabelle invented_table')));
});

test('abgelaufene Ausnahmen lassen die Prüfung fehlschlagen', t => {
  const config = 'export const COVERAGE_EXCEPTIONS = [{ kind: "excluded", reason: "Technische Einstellungstabelle ohne eigenen Workflow.", expiresOn: "2026-01-01", tables: ["settings"] }];';
  const report = collectCoverage(fixture(t, { config }), { today: TODAY });
  assert.ok(report.errors.some(e => e.includes('Ausnahme abgelaufen am 2026-01-01')));
});

test('Ausnahmen ohne Begründung oder mit ungültigem Datum werden abgewiesen', t => {
  const config = 'export const COVERAGE_EXCEPTIONS = [{ kind: "excluded", reason: "zu kurz", expiresOn: "bald", tables: ["settings"] }];';
  const report = collectCoverage(fixture(t, { config }), { today: TODAY });
  assert.ok(report.errors.some(e => e.includes('ohne ausreichende Begründung')));
  assert.ok(report.errors.some(e => e.includes('ohne gültiges Ablaufdatum')));
});

test('Ausnahmen für bereits durch ein Szenario gedeckte Tabellen sind überflüssig', t => {
  const config = 'export const COVERAGE_EXCEPTIONS = [{ kind: "excluded", reason: "Technische Einstellungstabelle ohne eigenen Workflow.", expiresOn: "2027-06-30", tables: ["tasks"] }];';
  const report = collectCoverage(fixture(t, { config }), { today: TODAY });
  assert.ok(report.errors.some(e => e.includes('Ausnahme für tasks ist überflüssig')));
});

test('unbekannte und mehrfach eingetragene Ausnahmen werden abgewiesen', t => {
  const config = 'export const COVERAGE_EXCEPTIONS = [{ kind: "excluded", reason: "Technische Einstellungstabelle ohne eigenen Workflow.", expiresOn: "2027-06-30", tables: ["invented_table", "settings"] }, { kind: "deferred", reason: "Eigenes Szenario für Notizen steht noch aus.", expiresOn: "2027-06-30", tables: ["settings"] }];';
  const report = collectCoverage(fixture(t, { config }), { today: TODAY });
  assert.ok(report.errors.some(e => e.includes('Ausnahme für unbekannte Tabelle: invented_table')));
  assert.ok(report.errors.some(e => e.includes('mehrfach als Ausnahme')));
});

test('listet Fachfunktionen ohne Selbsttest aus dem Katalog', t => {
  const inventory = {
    area: { id: 'aufgaben', title: 'Aufgaben' },
    features: [
      { id: 'tasks.subtasks', name: 'Unteraufgaben', category: 'fachlich', implementationStatus: 'implementiert', coverage: 'keine', tables: ['notes'] },
      { id: 'tasks.create', name: 'Aufgabe erstellen', category: 'fachlich', implementationStatus: 'implementiert', coverage: 'selftest', tables: ['tasks'] },
      { id: 'tasks.old', name: 'Alt', category: 'fachlich', implementationStatus: 'entfernt', coverage: 'keine', tables: [] },
    ],
  };
  const report = collectCoverage(fixture(t, { inventory }), { today: TODAY });
  assert.deepEqual(report.uncoveredFeatures, [{ id: 'tasks.subtasks', name: 'Unteraufgaben', area: 'aufgaben', tables: ['notes'] }]);
  assert.match(renderCoverage(report), /tasks\.subtasks/);
});
