import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { collectScenarios } from '../build-feature-catalog.mjs';
import { ARTIFACT_FILE, CONFIG_FILE, buildArtifact, derivePulseAreas, renderArtifact } from '../build-pulse-areas.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const scenario = (id, features, registered = true, touches = []) => ({ id, features, registered, touches });

const twoAreas = {
  flow: ['a', 'b'],
  areas: [
    { id: 'a', title: 'A', primaryTags: ['ta'] },
    { id: 'b', title: 'B', primaryTags: ['tb'] },
  ],
};

test('leitet Szenarien über den ersten Domänen-Tag ab', () => {
  const { areas, errors } = derivePulseAreas({
    config: twoAreas,
    scenarios: [scenario('s-b', ['tb', 'ta']), scenario('s-a', ['ta'])],
  });
  assert.deepEqual(errors, []);
  assert.deepEqual(areas[0].scenarios, ['s-a']);
  assert.deepEqual(areas[1].scenarios, ['s-b']);
});

test('fest zugeordnete Szenarien haben Vorrang vor ihrem Tag', () => {
  const config = {
    flow: ['a', 'c'],
    areas: [
      { id: 'a', title: 'A', primaryTags: ['ta'] },
      { id: 'c', title: 'C', primaryTags: ['tc'], scenarioIds: ['s-pin'] },
    ],
  };
  const { areas, errors } = derivePulseAreas({
    config,
    scenarios: [scenario('s-pin', ['ta']), scenario('s-a', ['ta']), scenario('s-c', ['tc'])],
  });
  assert.deepEqual(errors, []);
  assert.deepEqual(areas[0].scenarios, ['s-a']);
  assert.deepEqual(areas[1].scenarios, ['s-c', 's-pin']);
});

test('Haupttabellen stammen aus dem ersten touches-Eintrag der Szenarien', () => {
  const { areas, errors } = derivePulseAreas({
    config: twoAreas,
    scenarios: [scenario('s-a', ['ta'], true, ['contacts', 'tasks']), scenario('s-b', ['tb'], true, ['contacts'])],
  });
  assert.deepEqual(errors, []);
  assert.deepEqual(areas[0].tables, ['contacts']);
  assert.deepEqual(areas[1].tables, ['contacts']);
});

test('unbekannte Szenario-ID schlägt fehl', () => {
  const config = { flow: ['a', 'b'], areas: [{ id: 'a', title: 'A', primaryTags: ['ta'], scenarioIds: ['gibt-es-nicht'] }, { id: 'b', title: 'B', primaryTags: ['tb'] }] };
  const { errors } = derivePulseAreas({ config, scenarios: [scenario('s-a', ['ta']), scenario('s-b', ['tb'])] });
  assert.ok(errors.some((error) => error.includes('gibt-es-nicht')), errors.join('\n'));
});

test('nicht registriertes Szenario schlägt fehl', () => {
  const config = { flow: ['a', 'b'], areas: [{ id: 'a', title: 'A', primaryTags: ['ta'], scenarioIds: ['s-a'] }, { id: 'b', title: 'B', primaryTags: ['tb'] }] };
  const { errors } = derivePulseAreas({ config, scenarios: [scenario('s-a', ['ta'], false), scenario('s-b', ['tb'])] });
  assert.ok(errors.some((error) => error.includes('nicht registriertes Szenario "s-a"')), errors.join('\n'));
});

test('Tag ohne registriertes Szenario schlägt fehl', () => {
  const config = { flow: ['a'], areas: [{ id: 'a', title: 'A', primaryTags: ['ta', 'leer'] }] };
  const { errors } = derivePulseAreas({ config, scenarios: [scenario('s-a', ['ta'])] });
  assert.ok(errors.some((error) => error.includes('Tag "leer"')), errors.join('\n'));
});

test('ein Bereich ohne Szenario schlägt fehl', () => {
  const { errors } = derivePulseAreas({ config: twoAreas, scenarios: [scenario('s-a', ['ta'])] });
  assert.ok(errors.some((error) => error.includes('Bereich "b" hat kein Szenario')), errors.join('\n'));
});

test('unbekannter oder doppelter flow-Eintrag schlägt fehl', () => {
  const config = { flow: ['a', 'woanders', 'a'], areas: [{ id: 'a', title: 'A', primaryTags: ['ta'] }] };
  const { errors } = derivePulseAreas({ config, scenarios: [scenario('s-a', ['ta'])] });
  assert.ok(errors.some((error) => error.includes('unbekannten Bereich "woanders"')));
  assert.ok(errors.some((error) => error.includes('steht doppelt in flow')));
});

test('ein Tag darf nur einem Bereich gehören', () => {
  const config = {
    flow: ['a', 'b'],
    areas: [
      { id: 'a', title: 'A', primaryTags: ['ta'] },
      { id: 'b', title: 'B', primaryTags: ['ta'] },
    ],
  };
  const { errors } = derivePulseAreas({ config, scenarios: [scenario('s-a', ['ta'])] });
  assert.ok(errors.some((error) => error.includes('doppelt vergeben')));
});

const realAreas = () => {
  const config = JSON.parse(readFileSync(join(root, CONFIG_FILE), 'utf8'));
  const scenarios = collectScenarios(root);
  return derivePulseAreas({ config, scenarios });
};

test('Artefakt entspricht der Szenario-Registry', () => {
  const { areas, flow, errors } = realAreas();
  assert.deepEqual(errors, []);
  assert.equal(readFileSync(join(root, ARTIFACT_FILE), 'utf8'), renderArtifact(buildArtifact(areas, flow)));
});

test('Jour fixe enthält das registrierte Plattform-Szenario', () => {
  const areas = realAreas().areas;
  const scenarios = collectScenarios(root);
  const meetings = areas.find((area) => area.id === 'meetings');
  assert.ok(meetings.scenarios.includes('jour-fixe-platform-integration'));
  assert.ok(scenarios.some((s) => s.id === 'jour-fixe-platform-integration' && s.registered));
});

test('Zugriffsschutz enthält ausschließlich geprüfte Szenarien', () => {
  const areas = realAreas().areas;
  const security = areas.find((area) => area.id === 'security');
  assert.ok(security.scenarios.includes('access-boundaries'));
  for (const area of areas.filter((entry) => entry.id !== 'security')) {
    assert.ok(!area.scenarios.includes('access-boundaries'), `${area.id} darf access-boundaries nicht führen`);
  }
});

test('kein Szenario liegt in zwei Bereichen', () => {
  const areas = realAreas().areas;
  const seen = new Set();
  for (const area of areas) {
    for (const id of area.scenarios) {
      assert.ok(!seen.has(id), `${id} liegt doppelt`);
      seen.add(id);
    }
  }
  assert.equal(seen.size, areas.reduce((sum, area) => sum + area.scenarios.length, 0));
});

test('Ablauf führt die sechs Fachbereiche in der geforderten Reihenfolge', () => {
  const { flow } = realAreas();
  assert.deepEqual(flow, ['contacts', 'appointments', 'cases', 'tasks', 'decisions', 'meetings']);
});
