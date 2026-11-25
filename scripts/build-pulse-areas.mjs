#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectScenarios, loadInventory } from './build-feature-catalog.mjs';

/**
 * Puls-Bereiche: leitet die Szenarien je Bereich aus den registrierten
 * Selbsttest-Szenarien ab, statt sie im Code von Hand zu listen.
 *
 * Quelle der Zuordnung ist der **erste Domänen-Tag** eines Szenarios
 * (`features[0]`, z. B. `meetings` bei `jour-fixe-platform-integration`).
 * Jeder Bereich beansprucht eine Menge dieser Tags; neue Szenarien erscheinen
 * dadurch automatisch, sobald sie registriert sind.
 *
 * `groups` fasst die Bereiche fachlich zusammen (Vorgangsbetrieb, Termine &
 * Repräsentanz, Wächter). Die Karte zeichnet keine künstliche Gesamtkette mehr,
 * sondern zeigt die Gruppen und im Detail die deklarierten Schritte der
 * Szenarien mit ihren gespeicherten Ergebnissen.
 *
 * `workflows` übernimmt je Szenario die deklarierten Schritte (id, label).
 * Schritte deklarieren selbst keine Features; die Katalog-Funktionen, die das
 * Szenario in `scenarios` beanspruchen, stehen deshalb einmal am Workflow und
 * dienen dem Link in den Funktionskatalog.
 *
 * Geprüft wird:
 *  - jede `scenarioIds`-Referenz existiert und ist registriert,
 *  - jeder Tag trifft mindestens ein registriertes Szenario,
 *  - jeder Bereich hat mindestens ein Szenario,
 *  - `groups` nennt nur existierende Bereiche, jeden genau einmal,
 *  - das eingecheckte Artefakt entspricht der Registry (Drift-Sperre).
 *
 * Aufrufe:
 *   node scripts/build-pulse-areas.mjs            # Drift-Prüfung (CI)
 *   node scripts/build-pulse-areas.mjs --write    # Artefakt neu erzeugen
 *   node scripts/build-pulse-areas.mjs --audit    # Übersicht ausgeben
 */

export const CONFIG_FILE = 'src/features/system-pulse/pulse-areas.config.json';
export const ARTIFACT_FILE = 'src/features/system-pulse/generated/pulse-areas.json';
export const REGISTRY_FILE = 'src/features/selftest/registry.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Reine Ableitung: nimmt Bereichs-Konfiguration, Szenarien und Katalogfunktionen
 * und liefert Bereiche mit Workflows, Gruppen und alle Fehler.
 */
export function derivePulseAreas({ config, scenarios, features = [] }) {
  const errors = [];
  const configured = config?.areas;
  if (!Array.isArray(configured) || configured.length === 0) {
    return { areas: [], groups: [], errors: ['Konfiguration enthält keine Bereiche.'] };
  }

  const registered = scenarios.filter((scenario) => scenario.registered !== false);
  const knownScenarios = new Map(registered.map((scenario) => [scenario.id, scenario]));
  const areaIds = new Set();
  const tagOwner = new Map();

  for (const area of configured) {
    if (!area.id) {
      errors.push(`Bereich ohne id: ${JSON.stringify(area)}`);
      continue;
    }
    if (areaIds.has(area.id)) errors.push(`Doppelte Bereichs-ID: ${area.id}`);
    areaIds.add(area.id);
    for (const tag of area.primaryTags ?? []) {
      const owner = tagOwner.get(tag);
      if (owner && owner !== area.id) errors.push(`Tag "${tag}" ist doppelt vergeben: ${owner} und ${area.id}`);
      tagOwner.set(tag, area.id);
    }
  }

  const groups = Array.isArray(config.groups) ? config.groups : [];
  if (groups.length === 0) errors.push('groups muss mindestens eine Gruppe nennen.');
  const groupedAreas = new Map();
  for (const group of groups) {
    if (!group.id || !group.title) errors.push(`Gruppe ohne id/title: ${JSON.stringify(group)}`);
    if (!Array.isArray(group.areas) || group.areas.length === 0) errors.push(`Gruppe "${group.id ?? '?'}" nennt keine Bereiche.`);
    for (const id of group.areas ?? []) {
      if (!areaIds.has(id)) errors.push(`Gruppe "${group.id}" verweist auf unbekannten Bereich "${id}".`);
      const owner = groupedAreas.get(id);
      if (owner) errors.push(`Bereich "${id}" ist mehrfach gruppiert: ${owner} und ${group.id}.`);
      groupedAreas.set(id, group.id);
    }
  }
  for (const area of configured) {
    if (area.id && !groupedAreas.has(area.id)) errors.push(`Bereich "${area.id}" ist keiner Gruppe zugeordnet.`);
  }

  const featureIdsByScenario = new Map();
  for (const feature of features) {
    for (const scenarioId of feature.scenarios ?? []) {
      if (!featureIdsByScenario.has(scenarioId)) featureIdsByScenario.set(scenarioId, []);
      featureIdsByScenario.get(scenarioId).push(feature.id);
    }
  }

  const assigned = new Map();

  // Feste Zuordnungen zuerst, damit sie nicht vom Tag eines anderen Bereichs
  // beansprucht werden.
  for (const area of configured) {
    for (const id of area.scenarioIds ?? []) {
      if (!knownScenarios.has(id)) {
        errors.push(`Bereich "${area.id}" verweist auf unbekanntes oder nicht registriertes Szenario "${id}".`);
        continue;
      }
      const owner = assigned.get(id);
      if (owner && owner !== area.id) errors.push(`Szenario "${id}" ist bereits dem Bereich "${owner}" zugeordnet (Bereich "${area.id}").`);
      assigned.set(id, area.id);
    }
  }

  for (const area of configured) {
    for (const scenario of registered) {
      if (assigned.has(scenario.id)) continue; // feste Zuordnung hat Vorrang
      const primaryTag = scenario.features[0];
      if (!primaryTag || tagOwner.get(primaryTag) !== area.id) continue;
      assigned.set(scenario.id, area.id);
    }
  }

  for (const area of configured) {
    for (const tag of area.primaryTags ?? []) {
      if (!registered.some((scenario) => scenario.features[0] === tag)) {
        errors.push(`Tag "${tag}" (Bereich "${area.id}") trifft kein registriertes Szenario.`);
      }
    }
  }

  const areas = configured.map((area) => {
    const areaScenarios = registered
      .filter((scenario) => assigned.get(scenario.id) === area.id)
      .map((scenario) => scenario.id)
      .sort((a, b) => a.localeCompare(b));
    const tables = [...new Set(
      areaScenarios
        .map((id) => knownScenarios.get(id)?.touches?.[0])
        .filter((table) => typeof table === 'string' && table.length > 0),
    )].sort((a, b) => a.localeCompare(b));
    const workflows = areaScenarios.map((id) => {
      const scenario = knownScenarios.get(id);
      const scenarioFeatures = [...new Set(featureIdsByScenario.get(id) ?? [])].sort((a, b) => a.localeCompare(b));
      return {
        scenario: id,
        title: scenario?.title ?? id,
        features: scenarioFeatures,
        steps: (scenario?.steps ?? []).map((step) => ({ id: step.id, label: step.label })),
      };
    });
    return {
      id: area.id,
      title: area.title,
      primaryTags: [...(area.primaryTags ?? [])],
      scenarioIds: [...(area.scenarioIds ?? [])],
      scenarios: areaScenarios,
      tables,
      workflows,
    };
  });

  for (const area of areas) {
    if (area.scenarios.length === 0) errors.push(`Bereich "${area.id}" hat kein Szenario.`);
    if (area.workflows.every((workflow) => workflow.steps.length === 0)) errors.push(`Bereich "${area.id}" hat keine deklarierten Schritte.`);
  }

  return { areas, groups, errors };
}

export function buildArtifact(areas, groups) {
  return {
    version: 4,
    generatedBy: 'scripts/build-pulse-areas.mjs',
    source: REGISTRY_FILE,
    groups,
    areas,
  };
}

export const renderArtifact = (artifact) => `${JSON.stringify(artifact, null, 2)}\n`;

function load() {
  const config = JSON.parse(readFileSync(join(ROOT, CONFIG_FILE), 'utf8'));
  const scenarios = collectScenarios(ROOT);
  const inventory = loadInventory(ROOT);
  return { config, scenarios, features: inventory.features };
}

function main() {
  const write = process.argv.includes('--write');
  const audit = process.argv.includes('--audit');
  const { config, scenarios, features } = load();
  const { areas, groups, errors } = derivePulseAreas({ config, scenarios, features });

  if (errors.length > 0) {
    console.error('Puls-Bereiche sind nicht ableitbar:');
    for (const error of errors) console.error(`  - ${error}`);
    process.exit(1);
  }

  const artifact = buildArtifact(areas, groups);
  const rendered = renderArtifact(artifact);
  const scenarioCount = scenarios.filter((scenario) => scenario.registered !== false).length;

  if (audit) {
    for (const group of groups) {
      console.log(`${group.title} (${group.id})`);
      for (const id of group.areas) {
        const area = areas.find((entry) => entry.id === id);
        console.log(`  ${area.title}: ${area.scenarios.length} Szenario(en), ${area.workflows.reduce((sum, workflow) => sum + workflow.steps.length, 0)} Schritte`);
        for (const workflow of area.workflows) console.log(`    - ${workflow.scenario} (${workflow.steps.length} Schritte)`);
      }
    }
    console.log(`\n${groups.length} Gruppen, ${areas.length} Bereiche aus ${scenarioCount} registrierten Szenarien.`);
    return;
  }

  if (write) {
    const target = join(ROOT, ARTIFACT_FILE);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, rendered);
    console.log(`Puls-Bereiche geschrieben: ${ARTIFACT_FILE} (${areas.length} Bereiche, ${scenarioCount} Szenarien).`);
    return;
  }

  const target = join(ROOT, ARTIFACT_FILE);
  if (!existsSync(target) || readFileSync(target, 'utf8') !== rendered) {
    console.error(`Puls-Bereiche weichen von der Szenario-Registry ab: ${ARTIFACT_FILE}`);
    console.error('Neu erzeugen mit: npm run update:pulse-areas');
    process.exit(1);
  }
  console.log(`Puls-Bereiche aktuell: ${areas.length} Bereiche aus ${scenarioCount} registrierten Szenarien.`);
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) main();
