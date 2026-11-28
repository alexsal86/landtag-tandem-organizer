#!/usr/bin/env node
// Rückfall-Sperre für Meldungstypen.
//
// Jeder Typ, den der Client per create_notification erzeugt, muss im mandantenbezogenen
// Standard-Seed stehen (sonst liefert create_notification für neue Büros still NULL).
// Zusätzlich müssen die im Selbsttest erwarteten Typen im Seed vorkommen, jeder Seed-
// Eintrag braucht eine Kategorie, und jeder im Client erzeugte Typ braucht ein
// ausdrückliches Deep-Link-Ziel (kein stiller default-Fallback).
//
// Aufruf: npm run check:notification-types
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SEED_FILE = 'supabase/functions/_shared/tenant-seed.ts';
const EXPECTATIONS_FILE = 'src/features/selftest/notificationTypeExpectations.ts';
const DEEP_LINK_FILE = 'src/utils/notificationDeepLinks.ts';
const SETTINGS_FILE = 'src/components/notifications/NotificationSettings.tsx';
const SOURCE_ROOT = 'src';

const read = (file) => readFileSync(file, 'utf8');

/** Liest die Objekte aus STANDARD_NOTIFICATION_TYPES. */
function readSeedTypes() {
  const source = read(SEED_FILE);
  const start = source.indexOf('STANDARD_NOTIFICATION_TYPES');
  if (start === -1) throw new Error(`${SEED_FILE}: STANDARD_NOTIFICATION_TYPES nicht gefunden`);
  const end = source.indexOf('];', start);
  const block = source.slice(start, end);
  const entries = [];
  for (const match of block.matchAll(/\{([^}]*)\}/g)) {
    const body = match[1];
    const name = body.match(/name:\s*"([^"]+)"/);
    if (!name) continue;
    entries.push({
      name: name[1],
      label: body.match(/label:\s*"([^"]*)"/)?.[1] ?? '',
      category: body.match(/category:\s*"([^"]*)"/)?.[1] ?? '',
    });
  }
  return entries;
}

function readExpectations() {
  const source = read(EXPECTATIONS_FILE);
  const start = source.indexOf('REQUIRED_NOTIFICATION_TYPES');
  const end = source.indexOf(']', start);
  return [...source.slice(start, end).matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, files);
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry)) {
      files.push(full);
    }
  }
  return files;
}

/** Typnamen aus echten supabase.rpc('create_notification', …)-Aufrufen. */
function readClientUsage() {
  const usage = new Map();
  for (const file of walk(SOURCE_ROOT)) {
    const source = read(file);
    for (const call of source.matchAll(/\.rpc\(\s*['"]create_notification['"]/g)) {
      const block = source.slice(call.index, call.index + 900);
      const type = block.match(/type_name\s*:\s*['"]([a-z0-9_]+)['"]/);
      if (type) {
        const list = usage.get(type[1]) ?? [];
        list.push(relative(process.cwd(), file));
        usage.set(type[1], list);
      }
    }
  }
  return usage;
}

/** Kanonische Kategorie-Schlüssel aus der Einstellungsseite. */
function readUiCategories() {
  const source = read(SETTINGS_FILE);
  const start = source.indexOf('CATEGORY_META');
  if (start === -1) throw new Error(`${SETTINGS_FILE}: CATEGORY_META nicht gefunden`);
  const end = source.indexOf('};', start);
  return new Set(
    [...source.slice(start, end).matchAll(/^\s*([a-z][a-z0-9_]*):\s*\{/gm)].map((m) => m[1]),
  );
}

function readDeepLinkCases() {
  const source = read(DEEP_LINK_FILE);
  const cases = new Set();
  for (const match of source.matchAll(/case\s+'([a-z0-9_]+)'\s*:/g)) cases.add(match[1]);
  return cases;
}

const failures = [];
const warnings = [];

const seed = readSeedTypes();
const seedNames = new Set();
for (const entry of seed) {
  if (!entry.name) continue;
  if (seedNames.has(entry.name)) failures.push(`Doppelter Seed-Eintrag: ${entry.name}`);
  seedNames.add(entry.name);
  if (!entry.category) failures.push(`Seed-Eintrag ohne Kategorie: ${entry.name}`);
  if (!entry.label) warnings.push(`Seed-Eintrag ohne Label: ${entry.name}`);
}

const uiCategories = readUiCategories();
const unknownCategories = new Map();
for (const entry of seed) {
  if (entry.category && !uiCategories.has(entry.category) && !unknownCategories.has(entry.category)) {
    unknownCategories.set(entry.category, entry.name);
  }
}
for (const [category, type] of unknownCategories) {
  failures.push(`Seed-Kategorie "${category}" fehlt in CATEGORY_META (z. B. bei ${type})`);
}

const expectations = readExpectations();
for (const name of expectations) {
  if (!seedNames.has(name)) failures.push(`Selbsttest erwartet Typ, der nicht im Seed steht: ${name}`);
}

const usage = readClientUsage();
for (const [name, files] of [...usage].sort()) {
  if (!seedNames.has(name)) {
    failures.push(`Client erzeugt Typ ohne Seed-Eintrag: ${name} (${[...new Set(files)].join(', ')})`);
  }
}

const deepLinkCases = readDeepLinkCases();
for (const name of [...usage.keys()].sort()) {
  if (!deepLinkCases.has(name)) {
    failures.push(`Client erzeugt Typ ohne ausdrückliches Deep-Link-Ziel: ${name}`);
  }
}

console.log(`Meldungstypen: ${seed.length} im Seed, ${usage.size} im Client erzeugt, ${expectations.length} im Selbsttest erwartet, ${uiCategories.size} Anzeige-Gruppen.`);
if (warnings.length > 0) {
  console.log('Hinweise:');
  for (const warning of warnings) console.log(`  - ${warning}`);
}
if (failures.length > 0) {
  console.error('Fehler:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exitCode = 1;
} else {
  console.log('OK: Seed, Selbsttest-Erwartungen, Client-Typen und Deep-Link-Ziele sind deckungsgleich.');
}
