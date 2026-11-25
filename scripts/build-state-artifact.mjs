#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

/**
 * Zustandsartefakt: leitet Zustände, belegte Übergänge und Guard-Trigger
 * ausschließlich aus Quellcode ab und schreibt sie als versioniertes Artefakt.
 *
 * Quellen:
 *  - `src/integrations/supabase/types.ts` (Tabellen, Spalten, Enum-Werte)
 *  - `supabase/migrations/*.sql` (Enum-Definitionen, CHECK-Constraints,
 *    Schreibvorgänge `UPDATE … SET <status>='x'`, Trigger und Guard-Funktionen)
 *
 * Nichts davon wird von Hand gepflegt. Ohne `--write` prüft der Aufruf, ob das
 * eingecheckte Artefakt noch zum Quellcode passt, und schlägt sonst fehl.
 *
 * Aufrufe:
 *   node scripts/build-state-artifact.mjs            # Drift-Prüfung (CI)
 *   node scripts/build-state-artifact.mjs --write    # Artefakt neu erzeugen
 *   node scripts/build-state-artifact.mjs --audit    # Übersicht ausgeben
 */

export const TYPES_FILE = 'src/integrations/supabase/types.ts';
export const MIGRATIONS_DIR = 'supabase/migrations';
export const ARTIFACT_FILE = 'src/features/feature-catalog/generated/state-machines.json';

const STATUS_COLUMN = /^(status|state|phase|stage)$|_status$/;
const NOT_A_MACHINE = /^(status_from|status_to|.*_status_from|.*_status_to)$/;

export const isStateColumn = (name) => STATUS_COLUMN.test(name) && !NOT_A_MACHINE.test(name);

/* ------------------------------------------------------------ Supabase-Typen */

const member = (node, key) =>
  node?.members?.find((entry) => entry.name && (ts.isIdentifier(entry.name) || ts.isStringLiteral(entry.name)) && entry.name.text === key);

const memberName = (node) =>
  node?.name && (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)) ? node.name.text : undefined;

/**
 * Liest Tabellen, statusartige Spalten und Enum-Werte aus den generierten
 * Supabase-Typen. Die Typen sind die maßgebliche Spaltenliste; die Migrationen
 * liefern nur die Bedeutungen.
 */
export function parseGeneratedTypes(source, file = TYPES_FILE) {
  const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const database = parsed.statements.find((node) => ts.isTypeAliasDeclaration(node) && node.name.text === 'Database');
  const publicType = member(database?.type, 'public')?.type;

  const enums = new Map();
  for (const entry of member(publicType, 'Enums')?.type?.members ?? []) {
    const name = memberName(entry);
    if (!name) continue;
    const values = [];
    const visit = (node) => {
      if (ts.isLiteralTypeNode(node) && ts.isStringLiteral(node.literal)) values.push(node.literal.text);
      ts.forEachChild(node, visit);
    };
    visit(entry.type);
    enums.set(name, values);
  }

  const columns = [];
  for (const table of member(publicType, 'Tables')?.type?.members ?? []) {
    const tableName = memberName(table);
    if (!tableName) continue;
    const row = member(table.type, 'Row')?.type;
    for (const column of row?.members ?? []) {
      const columnName = memberName(column);
      if (!columnName || !isStateColumn(columnName)) continue;
      const text = column.type.getText(parsed);
      const enumName = /Enums"\]\["([a-z0-9_]+)"\]/i.exec(text)?.[1] ?? null;
      columns.push({ table: tableName, column: columnName, enumName });
    }
  }
  columns.sort((a, b) => a.table.localeCompare(b.table) || a.column.localeCompare(b.column));
  return { enums, columns, tableCount: member(publicType, 'Tables')?.type?.members?.length ?? 0 };
}

/* --------------------------------------------------------------- Migrationen */

/** Enum-Definitionen (`create type … as enum (…)`); die letzte Definition gewinnt. */
export function collectEnumDefinitions(migrations) {
  const enums = new Map();
  for (const { file, sql } of migrations) {
    for (const match of sql.matchAll(/create\s+type\s+(?:public\.)?([a-z0-9_]+)\s+as\s+enum\s*\(([\s\S]*?)\)/gi)) {
      const values = [...match[2].matchAll(/'([^']*)'/g)].map((entry) => entry[1]);
      if (values.length) enums.set(match[1], { values, source: file });
    }
  }
  return enums;
}

/**
 * CHECK-Constraints auf Statusspalten. Der Tabellenbezug ergibt sich aus dem
 * letzten `create table`/`alter table` vor dem Constraint im selben Skript.
 */
export function collectChecks(migrations) {
  const checks = [];
  for (const { file, sql } of migrations) {
    const contexts = [...sql.matchAll(/(?:create\s+table|alter\s+table)\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?([a-z0-9_]+)"?/gi)]
      .map((match) => ({ table: match[1], index: match.index ?? 0 }));
    const pattern = /check\s*\(\s*([a-z0-9_]+)\s*(?:in\s*\(([^)]*)\)|=\s*any\s*\(\s*array\s*\[([^\]]*)\]\s*\))/gi;
    for (const match of sql.matchAll(pattern)) {
      if (!isStateColumn(match[1])) continue;
      const context = [...contexts].reverse().find((entry) => entry.index < (match.index ?? 0));
      if (!context) continue;
      const values = [...(match[2] ?? match[3] ?? '').matchAll(/'([^']*)'/g)].map((entry) => entry[1]);
      if (values.length) checks.push({ table: context.table, column: match[1], values, source: file });
    }
  }
  return checks;
}

/** Belegte Schreibvorgänge: `UPDATE <tabelle> SET <status>='x' [WHERE <status>='y'|IN (…)]`. */
export function collectWrites(migrations) {
  const writes = [];
  for (const { file, sql } of migrations) {
    for (const statement of sql.matchAll(/update\s+(?:public\.)?([a-z0-9_]+)\s+set\s+([\s\S]*?)(?:;|$)/gi)) {
      const table = statement[1];
      const body = statement[2];
      const whereIndex = body.search(/\bwhere\b/i);
      const setClause = whereIndex >= 0 ? body.slice(0, whereIndex) : body;
      const whereClause = whereIndex >= 0 ? body.slice(whereIndex) : '';
      for (const column of new Set([...setClause.matchAll(/\b([a-z0-9_]+)\s*=\s*'/gi)].map((entry) => entry[1]))) {
        if (!isStateColumn(column)) continue;
        const to = [...setClause.matchAll(new RegExp(`\\b${column}\\s*=\\s*'([^']*)'`, 'gi'))].map((entry) => entry[1]);
        if (!to.length) continue;
        const froms = new Set();
        for (const match of whereClause.matchAll(new RegExp(`\\b${column}\\s*=\\s*'([^']*)'`, 'gi'))) froms.add(match[1]);
        for (const match of whereClause.matchAll(new RegExp(`\\b${column}\\s+in\\s*\\(([^)]*)\\)`, 'gi'))) {
          for (const value of match[1].matchAll(/'([^']*)'/g)) froms.add(value[1]);
        }
        for (const value of to) {
          writes.push({ table, column, to: value, from: [...froms].sort(), source: file });
        }
      }
    }
  }
  return writes;
}

/** Trigger-Bindungen und Guard-Funktionen aus den Migrationen (letzte Definition gewinnt). */
export function collectGuards(migrations) {
  const functions = new Map();
  for (const { file, sql } of migrations) {
    for (const match of sql.matchAll(
      /create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?([a-z0-9_]+)\s*\([\s\S]*?\)\s*returns\s+trigger[\s\S]*?as\s+\$\$([\s\S]*?)\$\$/gi,
    )) {
      functions.set(match[1], { body: match[2], source: file });
    }
  }

  const triggers = [];
  for (const { file, sql } of migrations) {
    for (const match of sql.matchAll(
      /create\s+(?:or\s+replace\s+)?(constraint\s+)?trigger\s+([a-z0-9_]+)\s+(before|after|instead\s+of)\s+([\s\S]*?)\s+on\s+(?:public\.)?([a-z0-9_]+)[\s\S]*?execute\s+(?:function|procedure)\s+(?:public\.)?([a-z0-9_]+)/gi,
    )) {
      const [, constraint, name, timing, events, table, functionName] = match;
      const definition = functions.get(functionName);
      if (!definition) continue;
      const referenced = new Set(
        [...definition.body.matchAll(/\b(OLD|NEW)\.([a-z0-9_]+)/gi)].map((entry) => entry[2].toLowerCase()),
      );
      const updateOf = /update\s+of\s+([a-z0-9_,\s]+)/i.exec(events)?.[1]
        ?.split(',')
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean) ?? [];
      triggers.push({
        trigger: name,
        function: functionName,
        timing: timing.toLowerCase().replace(/\s+/g, ' '),
        events: (constraint ? 'constraint ' : '') + events.replace(/\s+/g, ' ').trim().toLowerCase().replace(/\s+on$/, ''),
        table,
        updateOf,
        referenced: [...referenced].sort(),
        body: definition.body,
        raises: /raise\s+exception/i.test(definition.body),
        source: file,
        functionSource: definition.source,
      });
    }
  }
  return triggers;
}

/** Verglichene Zustandsliterale eines Guards für eine Spalte. */
function guardStates(body, column) {
  const values = new Set();
  const pattern = new RegExp(
    `\\b(?:old|new)\\.${column}\\b\\s*(?:=|<>|!=|is\\s+distinct\\s+from|in)\\s*('([^']*)'|\\(([^)]*)\\))`,
    'gi',
  );
  for (const match of body.matchAll(pattern)) {
    if (match[2] !== undefined) values.add(match[2]);
    else for (const entry of match[3].matchAll(/'([^']*)'/g)) values.add(entry[1]);
  }
  return [...values].sort();
}

/* ------------------------------------------------------------------ Artefakt */

const SOURCE_ORDER = ['enum', 'check', 'write', 'guard'];

function addState(index, machineId, value, source) {
  if (!value) return;
  const machine = index.get(machineId);
  if (!machine.states.has(value)) machine.states.set(value, new Set());
  machine.states.get(value).add(source);
}

/**
 * Baut das Artefakt aus den übergebenen Quellen. Reine Funktion ohne Dateizugriff,
 * damit die Ableitung testbar bleibt.
 */
export function buildStateArtifact({ typesSource, migrations, typesFile = TYPES_FILE }) {
  const { enums, columns } = parseGeneratedTypes(typesSource, typesFile);
  const enumDefinitions = collectEnumDefinitions(migrations);
  const checks = collectChecks(migrations);
  const writes = collectWrites(migrations);
  const triggers = collectGuards(migrations);

  const known = new Set(columns.map((entry) => `${entry.table}.${entry.column}`));
  const machines = new Map();
  for (const column of columns) {
    machines.set(`${column.table}.${column.column}`, {
      id: `${column.table}.${column.column}`,
      table: column.table,
      column: column.column,
      enumType: column.enumName,
      states: new Map(),
      transitions: new Map(),
      guards: new Map(),
    });
  }

  for (const column of columns) {
    const machine = machines.get(`${column.table}.${column.column}`);
    if (column.enumName) {
      const fromTypes = enums.get(column.enumName);
      const definition = enumDefinitions.get(column.enumName);
      const values = Array.isArray(fromTypes) ? fromTypes : definition?.values ?? [];
      for (const value of values) addState(machines, machine.id, value, `enum:${column.enumName}`);
    }
  }

  for (const check of checks) {
    const id = `${check.table}.${check.column}`;
    if (!known.has(id)) continue;
    for (const value of check.values) addState(machines, id, value, `check:${check.source}`);
  }

  for (const write of writes) {
    const id = `${write.table}.${write.column}`;
    if (!known.has(id)) continue;
    addState(machines, id, write.to, `write:${write.source}`);
    for (const from of write.from) addState(machines, id, from, `write:${write.source}`);
    const key = `${write.from.join(',')}->${write.to}`;
    const target = machines.get(id);
    if (!target.transitions.has(key)) {
      target.transitions.set(key, { from: write.from.length ? write.from : null, to: write.to, sources: new Set() });
    }
    target.transitions.get(key).sources.add(write.source);
  }

  for (const trigger of triggers) {
    const columnsForTable = columns.filter((entry) => entry.table === trigger.table);
    const guarded = new Set([...trigger.referenced, ...trigger.updateOf]);
    for (const column of columnsForTable) {
      if (!guarded.has(column.column)) continue;
      const id = `${column.table}.${column.column}`;
      const machine = machines.get(id);
      const states = guardStates(trigger.body, column.column);
      for (const value of states) addState(machines, id, value, `guard:${trigger.source}`);
      const readsOld = /\bold\./i.test(trigger.body);
      const readsNew = /\bnew\./i.test(trigger.body);
      const key = trigger.trigger;
      if (!machine.guards.has(key)) {
        machine.guards.set(key, {
          trigger: trigger.trigger,
          function: trigger.function,
          timing: trigger.timing,
          events: trigger.events,
          source: trigger.source,
          functionSource: trigger.functionSource,
          // Nur Funktionen, die bei Zustandsverstößen abbrechen, sind Guards.
          // Trigger ohne RAISE EXCEPTION beobachten oder synchronisieren nur.
          kind: trigger.raises && (readsOld || readsNew) ? 'guard' : 'trigger',
          readsOld,
          readsNew,
          raises: trigger.raises,
          states,
        });
      }
    }
  }

  const renderedMachines = [];
  const unresolved = [];
  for (const machine of machines.values()) {
    if (machine.states.size === 0) {
      unresolved.push({ table: machine.table, column: machine.column, reason: 'keine belegten Zustandswerte' });
      continue;
    }
    const states = [...machine.states.entries()]
      .map(([value, sources]) => ({
        value,
        sources: [...sources].sort(compareSources),
      }))
      .sort((a, b) => a.value.localeCompare(b.value));

    const transitions = [...machine.transitions.values()]
      .map((transition) => ({
        from: transition.from,
        to: transition.to,
        sources: [...transition.sources].sort(),
      }))
      .sort(
        (a, b) =>
          String(a.from).localeCompare(String(b.from)) ||
          a.to.localeCompare(b.to) ||
          a.sources.join(',').localeCompare(b.sources.join(',')),
      );

    const guards = [...machine.guards.values()].sort((a, b) => a.trigger.localeCompare(b.trigger));
    const limitations = [];
    if (!machine.enumType && !states.some((state) => state.sources.some((source) => source.startsWith('check:')))) {
      limitations.push('Keine Enum- oder CHECK-Beschränkung belegt; die Zustandswerte stammen nur aus Schreibvorgängen und Triggern.');
    }
    if (guards.length === 0) {
      limitations.push('Kein Trigger im Migrationsbestand gefunden; Übergänge sind nicht durch Trigger abgesichert.');
    } else if (!guards.some((guard) => guard.kind === 'guard')) {
      limitations.push('Nur beobachtende oder synchronisierende Trigger, keine Guard-Funktion mit RAISE EXCEPTION.');
    } else {
      limitations.push('Guards werden zitiert, aber nicht als vollständiger Automat interpretiert; abgeleitet werden nur belegte Schreibvorgänge.');
    }
    if (transitions.length === 0) {
      limitations.push('Keine belegten Statusübergänge im Migrationsbestand.');
    }
    if (transitions.some((transition) => transition.from === null)) {
      limitations.push('Übergänge ohne belegten Ausgangszustand sind mit "from": null gekennzeichnet.');
    }

    renderedMachines.push({
      id: machine.id,
      table: machine.table,
      column: machine.column,
      enumType: machine.enumType,
      states,
      transitions,
      guards,
      limitations,
    });
  }

  renderedMachines.sort((a, b) => a.id.localeCompare(b.id));
  unresolved.sort((a, b) => a.table.localeCompare(b.table) || a.column.localeCompare(b.column));

  // Schreibweisen-Kollisionen sind echte Befunde: derselbe Zustand in zwei Schreibweisen
  // ist im Quellcode nicht derselbe Wert. Sie werden gemeldet, nicht normalisiert.
  const anomalies = [];
  for (const machine of renderedMachines) {
    const byNormalized = new Map();
    for (const state of machine.states) {
      const normalized = state.value.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!byNormalized.has(normalized)) byNormalized.set(normalized, []);
      byNormalized.get(normalized).push(state.value);
    }
    for (const values of byNormalized.values()) {
      if (values.length > 1) {
        anomalies.push({
          machine: machine.id,
          values: values.sort(),
          reason: 'Zustandswerte unterscheiden sich nur in Trennzeichen oder Groß-/Kleinschreibung; im Quellcode sind sie verschieden.',
        });
      }
    }
  }
  anomalies.sort((a, b) => a.machine.localeCompare(b.machine) || a.values.join(',').localeCompare(b.values.join(',')));

  return {
    version: 1,
    generatedBy: 'scripts/build-state-artifact.mjs',
    description:
      'Abgeleitetes Zustandsartefakt. Zustände stammen aus Enum-Typen, CHECK-Constraints, belegten Schreibvorgängen und Guard-Vergleichen; Übergänge ausschließlich aus belegten UPDATE-Schreibvorgängen. Keine handgepflegten Übergänge.',
    sources: {
      types: typesFile,
      migrationsDirectory: MIGRATIONS_DIR,
      migrationCount: migrations.length,
    },
    machineCount: renderedMachines.length,
    anomalies,
    machines: renderedMachines,
    unresolved,
  };
}

const compareSources = (a, b) => {
  const rank = (value) => {
    const prefix = value.split(':')[0];
    const index = SOURCE_ORDER.indexOf(prefix);
    return index === -1 ? SOURCE_ORDER.length : index;
  };
  return rank(a) - rank(b) || a.localeCompare(b);
};

/* -------------------------------------------------------------------- Ablauf */

export function readSources(root) {
  const typesSource = readFileSync(join(root, TYPES_FILE), 'utf8');
  const directory = join(root, MIGRATIONS_DIR);
  const migrations = readdirSync(directory)
    .filter((file) => file.endsWith('.sql'))
    .sort()
    .map((file) => ({ file: `${MIGRATIONS_DIR}/${file}`, sql: readFileSync(join(directory, file), 'utf8') }));
  return { typesSource, migrations };
}

export function renderArtifact(root) {
  const artifact = buildStateArtifact({ ...readSources(root), typesFile: TYPES_FILE });
  const errors = validateArtifact(artifact, root);
  if (errors.length) throw new Error(errors.join('\n'));
  return `${JSON.stringify(artifact, null, 2)}\n`;
}

/** Strukturprüfung: Übergänge müssen belegte Zustände verwenden, Quellen müssen existieren. */
export function validateArtifact(artifact, root = process.cwd()) {
  const errors = [];
  const ids = new Set();
  for (const machine of artifact.machines) {
    if (ids.has(machine.id)) errors.push(`Doppelte Maschinen-ID: ${machine.id}`);
    ids.add(machine.id);
    const known = new Set(machine.states.map((state) => state.value));
    for (const transition of machine.transitions) {
      if (!known.has(transition.to)) errors.push(`${machine.id}: Zielzustand ${transition.to} ist kein belegter Zustand`);
      for (const from of transition.from ?? []) {
        if (!known.has(from)) errors.push(`${machine.id}: Ausgangszustand ${from} ist kein belegter Zustand`);
      }
      for (const source of transition.sources) {
        if (!existsSync(join(root, source))) errors.push(`${machine.id}: Quelle fehlt: ${source}`);
      }
    }
    for (const guard of machine.guards) {
      if (!existsSync(join(root, guard.source))) errors.push(`${machine.id}: Trigger-Quelle fehlt: ${guard.source}`);
      if (guard.kind === 'guard' && !guard.raises) {
        errors.push(`${machine.id}: ${guard.trigger} ist als Guard markiert, bricht aber nicht ab`);
      }
      if (!['guard', 'trigger'].includes(guard.kind)) {
        errors.push(`${machine.id}: ${guard.trigger} hat keine gültige Art (${guard.kind})`);
      }
    }
  }
  return errors;
}

function printAudit(artifact) {
  const allGuards = artifact.machines.flatMap((machine) => machine.guards);
  console.log('[state-artifact:audit]');
  console.log(`  Statusspalten:         ${artifact.machineCount + artifact.unresolved.length}`);
  console.log(`  Zustandsmaschinen:     ${artifact.machineCount}`);
  console.log(`  ohne belegte Zustände: ${artifact.unresolved.length}`);
  console.log(`  Übergänge:             ${artifact.machines.reduce((sum, machine) => sum + machine.transitions.length, 0)}`);
  console.log(`  Guards (Abbruch):      ${allGuards.filter((guard) => guard.kind === 'guard').length}`);
  console.log(`  Trigger (beobachtend): ${allGuards.filter((guard) => guard.kind === 'trigger').length}`);
  console.log(`  Schreibweisen-Befunde: ${artifact.anomalies.length}`);
  for (const machine of artifact.machines) {
    console.log(
      `    ${machine.id}: ${machine.states.length} Zustände, ${machine.transitions.length} Übergänge, ${machine.guards.length} Guards`,
    );
  }
  for (const entry of artifact.unresolved) console.log(`    offen: ${entry.table}.${entry.column} (${entry.reason})`);
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  const root = process.cwd();
  const artifact = buildStateArtifact({ ...readSources(root), typesFile: TYPES_FILE });
  const errors = validateArtifact(artifact, root);
  const expected = `${JSON.stringify(artifact, null, 2)}\n`;
  const target = join(root, ARTIFACT_FILE);
  const write = process.argv.includes('--write');

  if (write) {
    mkdirSync(resolve(target, '..'), { recursive: true });
    writeFileSync(target, expected);
  } else if (!existsSync(target)) {
    errors.push(`${ARTIFACT_FILE} fehlt. npm run update:state-artifact ausführen.`);
  } else if (readFileSync(target, 'utf8') !== expected) {
    errors.push(`${ARTIFACT_FILE} ist veraltet. npm run update:state-artifact ausführen.`);
  }

  if (process.argv.includes('--audit')) printAudit(artifact);
  if (process.argv.includes('--report')) printAudit(artifact);

  console.log('[state-artifact]', {
    machines: artifact.machineCount,
    unresolved: artifact.unresolved.length,
    transitions: artifact.machines.reduce((sum, machine) => sum + machine.transitions.length, 0),
    guards: artifact.machines.reduce((sum, machine) => sum + machine.guards.length, 0),
    errors: errors.length,
  });
  for (const error of errors) console.error(error);
  process.exitCode = errors.length ? 1 : 0;
}
