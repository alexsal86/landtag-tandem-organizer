#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectScenarios } from './build-feature-catalog.mjs';

/**
 * Puls-Bereiche: leitet die Szenarien je Bereich aus den registrierten
 * Selbsttest-Szenarien ab, statt sie im Code von Hand zu listen.
 *
 * Quelle der Zuordnung ist der **erste Domänen-Tag** eines Szenarios
 * (`features[0]`, z. B. `meetings` bei `jour-fixe-platform-integration`).
 * Jeder Bereich der Konfiguration beansprucht eine Menge dieser Tags. Neue
 * Szenarien erscheinen dadurch automatisch im passenden Bereich, sobald sie
 * registriert sind und ihren Domänen-Tag zuerst nennen.
 *
 * Einzelne Szenarien lassen sich mit `scenarioIds` fest zuordnen, wenn ihr
 * erster Tag eine andere Domäne nennt (z. B. `access-boundaries`, das fachlich
 * zum Zugriffsschutz gehört, aber zuerst `appointment-requests` taggt).
 *
 * `flow` ist der geordnete Arbeitsablauf der Kacheln; die Karte zeichnet
 * zwischen aufeinanderfolgenden Einträgen echte Pfeile. `tables` je Bereich
 * sind die Haupttabellen der zugeordneten Szenarien (erster `touches`-Eintrag).
 *
 * Geprüft wird:
 *  - jede `scenarioIds`-Referenz existiert und ist registriert,
 *  - jeder Tag trifft mindestens ein registriertes Szenario,
 *  - jeder Bereich hat mindestens ein Szenario,
 *  - `flow` nennt nur existierende Bereiche, ohne Doppelte,
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
 * Reine Ableitung: nimmt Bereichs-Konfiguration und Szenarien und liefert die
 * Bereiche mit aufgelösten Szenario-IDs, den Fluss und alle Fehler.
 */
export function derivePulseAreas({ config, scenarios }) {
  const errors = [];
  const configured = config?.areas;
  if (!Array.isArray(configured) || configured.length === 0) {
    return { areas: [], flow: [], errors: ['Konfiguration enthält keine Bereiche.'] };
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

  const flow = Array.isArray(config.flow) ? config.flow : [];
  if (flow.length < 2) errors.push('flow muss mindestens zwei Bereiche nennen.');
  const seenFlow = new Set();
  for (const id of flow) {
    if (seenFlow.has(id)) errors.push(`Bereich "${id}" steht doppelt in flow.`);
    seenFlow.add(id);
    if (!areaIds.has(id)) errors.push(`flow verweist auf unbekannten Bereich "${id}".`);
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
    return {
      id: area.id,
      title: area.title,
      primaryTags: [...(area.primaryTags ?? [])],
      scenarioIds: [...(area.scenarioIds ?? [])],
      scenarios: areaScenarios,
      tables,
    };
  });

  for (const area of areas) {
    if (area.scenarios.length === 0) errors.push(`Bereich "${area.id}" hat kein Szenario.`);
  }

  return { areas, flow, errors };
}

export function buildArtifact(areas, flow) {
  return {
    version: 2,
    generatedBy: 'scripts/build-pulse-areas.mjs',
    source: REGISTRY_FILE,
    flow,
    areas,
  };
}

export const renderArtifact = (artifact) => `${JSON.stringify(artifact, null, 2)}\n`;

function load() {
  const config = JSON.parse(readFileSync(join(ROOT, CONFIG_FILE), 'utf8'));
  const scenarios = collectScenarios(ROOT);
  return { config, scenarios };
}

function main() {
  const write = process.argv.includes('--write');
  const audit = process.argv.includes('--audit');
  const { config, scenarios } = load();
  const { areas, flow, errors } = derivePulseAreas({ config, scenarios });

  if (errors.length > 0) {
    console.error('Puls-Bereiche sind nicht ableitbar:');
    for (const error of errors) console.error(`  - ${error}`);
    process.exit(1);
  }

  const artifact = buildArtifact(areas, flow);
  const rendered = renderArtifact(artifact);
  const scenarioCount = scenarios.filter((scenario) => scenario.registered !== false).length;

  if (audit) {
    for (const area of areas) {
      console.log(`${area.title} (${area.id}): ${area.scenarios.length} Szenario(en)`);
      for (const id of area.scenarios) console.log(`  - ${id}`);
      if (area.tables.length > 0) console.log(`  Tabellen: ${area.tables.join(', ')}`);
    }
    console.log(`\nAblauf: ${flow.join(' → ')}`);
    console.log(`${areas.length} Bereiche aus ${scenarioCount} registrierten Szenarien.`);
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
