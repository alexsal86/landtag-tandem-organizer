import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { collectScenarios, loadInventory } from '../build-feature-catalog.mjs';
import { ARTIFACT_FILE, CONFIG_FILE, buildArtifact, derivePulseAreas, renderArtifact } from '../build-pulse-areas.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const defaultSteps = [{ id: 'step', label: 'Schritt' }];
const scenario = (id, features, registered = true, touches = [], steps = defaultSteps) => ({
  id, features, registered, touches, steps, description: `Beschreibung ${id}`, checks: ['Prüfung A'],
});

const twoAreas = {
  groups: [{ id: 'g', title: 'Gruppe', areas: ['a', 'b'] }],
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
    groups: [{ id: 'g', title: 'G', areas: ['a', 'c'] }],
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

test('übernimmt deklarierte Schritte und Katalog-Funktionen in den Workflow', () => {
  const { areas, errors } = derivePulseAreas({
    config: twoAreas,
    scenarios: [
      scenario('s-a', ['ta'], true, ['contacts'], [
        { id: 'create', label: 'Anlegen' },
        { id: 'check', label: 'Prüfen' },
      ]),
      scenario('s-b', ['tb'], true, ['tasks'], [{ id: 'finish', label: 'Abschluss' }]),
    ],
    features: [
      { id: 'contacts.create', scenarios: ['s-a'] },
      { id: 'tasks.close', scenarios: ['s-a', 's-b'] },
    ],
  });
  assert.deepEqual(errors, []);
  const workflow = areas[0].workflows[0];
  assert.equal(workflow.scenario, 's-a');
  assert.equal(workflow.description, 'Beschreibung s-a');
  assert.deepEqual(workflow.checks, ['Prüfung A']);
  assert.deepEqual(workflow.tables, ['contacts']);
  assert.deepEqual(workflow.features, ['contacts.create', 'tasks.close']);
  assert.deepEqual(workflow.steps.map((step) => step.id), ['create', 'check']);
  assert.deepEqual(workflow.steps, [
    { id: 'create', label: 'Anlegen' },
    { id: 'check', label: 'Prüfen' },
  ]);
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
  const config = { groups: [{ id: 'g', title: 'G', areas: ['a', 'b'] }], areas: [{ id: 'a', title: 'A', primaryTags: ['ta'], scenarioIds: ['gibt-es-nicht'] }, { id: 'b', title: 'B', primaryTags: ['tb'] }] };
  const { errors } = derivePulseAreas({ config, scenarios: [scenario('s-a', ['ta']), scenario('s-b', ['tb'])] });
  assert.ok(errors.some((error) => error.includes('gibt-es-nicht')), errors.join('\n'));
});

test('nicht registriertes Szenario schlägt fehl', () => {
  const config = { groups: [{ id: 'g', title: 'G', areas: ['a', 'b'] }], areas: [{ id: 'a', title: 'A', primaryTags: ['ta'], scenarioIds: ['s-a'] }, { id: 'b', title: 'B', primaryTags: ['tb'] }] };
  const { errors } = derivePulseAreas({ config, scenarios: [scenario('s-a', ['ta'], false), scenario('s-b', ['tb'])] });
  assert.ok(errors.some((error) => error.includes('nicht registriertes Szenario "s-a"')), errors.join('\n'));
});

test('Tag ohne registriertes Szenario schlägt fehl', () => {
  const config = { groups: [{ id: 'g', title: 'G', areas: ['a'] }], areas: [{ id: 'a', title: 'A', primaryTags: ['ta', 'leer'] }] };
  const { errors } = derivePulseAreas({ config, scenarios: [scenario('s-a', ['ta'])] });
  assert.ok(errors.some((error) => error.includes('Tag "leer"')), errors.join('\n'));
});

test('ein Bereich ohne Szenario schlägt fehl', () => {
  const { errors } = derivePulseAreas({ config: twoAreas, scenarios: [scenario('s-a', ['ta'])] });
  assert.ok(errors.some((error) => error.includes('Bereich "b" hat kein Szenario')), errors.join('\n'));
});

test('Gruppen müssen jeden Bereich genau einmal nennen', () => {
  const config = {
    groups: [
      { id: 'g1', title: 'G1', areas: ['a', 'woanders'] },
      { id: 'g2', title: 'G2', areas: ['a'] },
    ],
    areas: [{ id: 'a', title: 'A', primaryTags: ['ta'] }, { id: 'b', title: 'B', primaryTags: ['tb'] }],
  };
  const { errors } = derivePulseAreas({ config, scenarios: [scenario('s-a', ['ta']), scenario('s-b', ['tb'])] });
  assert.ok(errors.some((error) => error.includes('unbekannten Bereich "woanders"')));
  assert.ok(errors.some((error) => error.includes('mehrfach gruppiert')));
  assert.ok(errors.some((error) => error.includes('Bereich "b" ist keiner Gruppe zugeordnet')));
});

test('ein Tag darf nur einem Bereich gehören', () => {
  const config = {
    groups: [{ id: 'g', title: 'G', areas: ['a', 'b'] }],
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
  const inventory = loadInventory(root);
  return derivePulseAreas({ config, scenarios, features: inventory.features });
};

test('Artefakt entspricht der Szenario-Registry', () => {
  const { areas, groups, errors } = realAreas();
  assert.deepEqual(errors, []);
  assert.equal(readFileSync(join(root, ARTIFACT_FILE), 'utf8'), renderArtifact(buildArtifact(areas, groups)));
});

test('Jour fixe enthält das registrierte Plattform-Szenario mit Schritten', () => {
  const areas = realAreas().areas;
  const meetings = areas.find((area) => area.id === 'meetings');
  assert.ok(meetings.scenarios.includes('jour-fixe-platform-integration'));
  const workflow = meetings.workflows.find((entry) => entry.scenario === 'jour-fixe-platform-integration');
  assert.ok(workflow.steps.length > 0);
  assert.ok(workflow.steps.every((step) => step.label.length > 0));
  assert.ok(workflow.description.length > 0);
  assert.ok(workflow.checks.length > 0);
});

test('jeder Workflow trägt Beschreibung und Prüfumfang aus der Registry', () => {
  for (const area of realAreas().areas) {
    for (const workflow of area.workflows) {
      assert.ok(workflow.description.length > 0, `${workflow.scenario} ohne Beschreibung`);
      assert.ok(Array.isArray(workflow.checks), `${workflow.scenario} ohne checks`);
    }
  }
});

test('Kontakte verlinken auf ihre Katalogfunktionen', () => {
  const workflow = realAreas().areas.find((area) => area.id === 'contacts').workflows[0];
  assert.ok(workflow.features.includes('contacts.create'));
  assert.deepEqual(Object.keys(workflow.steps[0]).sort(), ['id', 'label']);
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

test('Gruppen decken Vorgangsbetrieb, Termine, Dokumente, Wahlen, Organisation, Regeln und Wächter', () => {
  const { groups } = realAreas();
  assert.deepEqual(groups.map((group) => group.id), [
    'operations', 'representation', 'documents', 'elections', 'organization', 'rules', 'guard',
  ]);
  assert.deepEqual(groups[0].areas, ['contacts', 'cases', 'tasks', 'decisions', 'meetings', 'day-slip']);
  assert.deepEqual(groups[1].areas, ['appointments']);
  assert.deepEqual(groups[2].areas, ['documents', 'knowledge']);
  assert.deepEqual(groups[3].areas, ['elections']);
  assert.deepEqual(groups[4].areas, ['employees', 'team-rituals', 'events']);
  assert.deepEqual(groups[5].areas, ['rules']);
  assert.deepEqual(groups[6].areas, ['security']);
});

test('jedes registrierte Szenario ist genau einem Bereich zugeordnet', () => {
  const { areas } = realAreas();
  const assigned = areas.flatMap((area) => area.scenarios);
  assert.equal(assigned.length, 30);
  assert.equal(new Set(assigned).size, 30);
});

test('ein registriertes Szenario ohne Bereich schlägt fehl', () => {
  const { errors } = derivePulseAreas({
    config: { groups: [{ id: 'g', title: 'G', areas: ['a'] }], areas: [{ id: 'a', title: 'A', primaryTags: ['ta'] }] },
    scenarios: [scenario('s-a', ['ta']), scenario('s-b', ['tb'])],
  });
  assert.ok(errors.some((error) => error.includes('Szenario "s-b" ist keinem Puls-Bereich zugeordnet')), errors.join('\n'));
});
