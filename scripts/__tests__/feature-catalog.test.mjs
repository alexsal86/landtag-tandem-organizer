import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  collectEdgeFunctions,
  collectRoutes,
  collectRpcInventory,
  collectScenarios,
  collectTables,
  computeMetrics,
  loadInventory,
  validateCatalog,
} from '../build-feature-catalog.mjs';

const root = process.cwd();

test('Inventar: Funktionen sind eindeutig und strukturvalidiert', () => {
  const inventory = loadInventory(root);
  assert.equal(inventory.errors.length, 0, inventory.errors.join('\n'));
  assert.ok(inventory.areas.length >= 10, 'mindestens zehn Funktionsbereiche');
  assert.ok(inventory.features.length >= 100, 'mindestens hundert Funktionen');
  const ids = inventory.features.map((feature) => feature.id);
  assert.equal(new Set(ids).size, ids.length, 'Funktions-IDs müssen eindeutig sein');
});

test('Inventar: jede Funktion hat Nachweis, Status und Kategorie', () => {
  const inventory = loadInventory(root);
  for (const feature of inventory.features) {
    assert.ok(feature.evidence.length > 0, `${feature.id}: Nachweis fehlt`);
    assert.ok(feature.category, `${feature.id}: Kategorie fehlt`);
    assert.ok(feature.implementationStatus, `${feature.id}: Implementierungsstatus fehlt`);
    assert.ok(feature.integrationStatus, `${feature.id}: Einbindungsstatus fehlt`);
    assert.ok(feature.coverage, `${feature.id}: Testabdeckung fehlt`);
    assert.ok(feature.testResult, `${feature.id}: Testergebnis fehlt`);
  }
});

test('Konsistenz: keine Fehler im aktuellen Katalog', () => {
  const inventory = loadInventory(root);
  const state = validateCatalog(root, inventory);
  assert.deepEqual(state.errors, [], state.errors.join('\n'));
  assert.equal(state.openCandidates.length, 0, `nicht zugeordnete Objekte: ${state.openCandidates.map((entry) => entry.key).join(', ')}`);
});

test('Routen: Router und Navigation werden inventarisiert, Catch-alls nicht', () => {
  const routes = collectRoutes(root).map((route) => route.path);
  assert.ok(routes.includes('/tasks'));
  assert.ok(routes.includes('/auth'));
  assert.ok(routes.includes('/funktionskatalog'));
  assert.ok(!routes.includes('/:section'));
  assert.ok(!routes.includes('/'));
});

test('Routen: jede inventarisierte Route ist einer Funktion zugeordnet', () => {
  const inventory = loadInventory(root);
  const state = validateCatalog(root, inventory);
  const unassigned = state.candidates.filter((candidate) => candidate.kind === 'route');
  assert.deepEqual(unassigned, []);
});

test('Edge Functions: Verzeichnisse werden erkannt, Hilfsmodule ausgeschlossen', () => {
  const functions = collectEdgeFunctions(root).map((entry) => entry.name);
  assert.ok(functions.length >= 20);
  assert.ok(functions.includes('send-decision-email'));
  assert.ok(!functions.includes('_shared'));
});

test('Datenbankfunktionen: wirksame Funktionen statt historischer Migrationen', () => {
  const rpcs = collectRpcInventory(root).map((entry) => entry.name);
  assert.ok(rpcs.includes('decide_appointment_request'));
  assert.ok(rpcs.includes('merge_contacts'));
  assert.ok(rpcs.includes('automation_private.advance_routine_package'));
});

test('Tabellen: generierte Typen liefern die Datenbankstruktur', () => {
  const { tables, views } = collectTables(root);
  assert.ok(tables.includes('contacts'));
  assert.ok(tables.includes('task_decisions'));
  assert.ok(views.length >= 1);
});

test('Selbsttests: alle Szenarien sind registriert', () => {
  const scenarios = collectScenarios(root);
  assert.ok(scenarios.length >= 20);
  assert.ok(scenarios.every((scenario) => scenario.registered), scenarios.filter((scenario) => !scenario.registered).map((scenario) => scenario.id).join(', '));
});

test('Kennzahlen: Berechnung folgt ausschließlich den Daten', () => {
  const features = [
    {
      id: 'a', area: 'x', subarea: 's', name: 'A', description: '', category: 'fachlich',
      implementationStatus: 'implementiert', integrationStatus: 'ui', coverage: 'selftest', testResult: 'nicht-ausgefuehrt',
      evidence: ['src/App.tsx'], routes: [], components: [], services: [], hooks: [], edgeFunctions: [], rpcs: [],
      tables: [], roles: [], dependsOn: [], scenarios: ['s'], unitTests: [], integrationTests: [], e2eTests: [],
      docs: [], limitations: [], reviewPoints: [],
    },
    {
      id: 'b', area: 'x', subarea: 's', name: 'B', description: '', category: 'technisch',
      implementationStatus: 'verwaist', integrationStatus: 'ohne-einbindung', coverage: 'keine', testResult: 'unbekannt',
      evidence: ['src/App.tsx'], routes: [], components: [], services: [], hooks: [], edgeFunctions: [], rpcs: [],
      tables: [], roles: [], dependsOn: [], scenarios: [], unitTests: [], integrationTests: [], e2eTests: [],
      docs: ['docs/entity-map.md'], limitations: [], reviewPoints: [],
    },
  ];
  const metrics = computeMetrics(features);
  assert.equal(metrics.features, 2);
  assert.equal(metrics.areas, 1);
  assert.equal(metrics.implemented, 1);
  assert.equal(metrics.orphaned, 1);
  assert.equal(metrics.withSelftest, 1);
  assert.equal(metrics.withoutAnyTest, 1);
  assert.equal(metrics.missingDocumentation, 1);
  assert.equal(metrics.unverifiedIntegration, 1);
});
