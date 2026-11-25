#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
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
 *    Spalten-Defaults, INSERT/UPDATE-Schreibvorgänge, Trigger und Guard-Funktionen)
 *  - registrierte TS-Regelmodule (`TS_STATE_SOURCES`, z. B. ALLOWED_TRANSITIONS)
 *  - Client-Schreibvorgänge (`from(...).update({ status: ... })`) als Abgleich
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

/**
 * Handgepflegte Zustandsregeln in TypeScript, die gegen das abgeleitete
 * Artefakt geprüft werden. Neue Regelmodule werden hier registriert, damit
 * Abweichungen sichtbar werden statt nur im Kopf der Autoren zu existieren.
 */
export const TS_STATE_SOURCES = [
  {
    file: 'src/components/letters/types.ts',
    machine: 'letters.status',
    exportName: 'ALLOWED_TRANSITIONS',
    label: 'Freigaberegeln des Briefeditors',
  },
];

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

/* ------------------------------------------------------------------ Helfer */

/** Teilt Text an Trennzeichen auf oberster Ebene und respektiert Quotes/Klammern. */
export function splitTopLevel(text, separator = ',') {
  const parts = [];
  let depth = 0;
  let quote = null;
  let current = '';
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quote) {
      current += char;
      if (char === quote) {
        if (text[index + 1] === quote) {
          current += text[index + 1];
          index += 1;
        } else {
          quote = null;
        }
      }
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      current += char;
      continue;
    }
    if (char === '(') {
      depth += 1;
      current += char;
      continue;
    }
    if (char === ')') {
      depth -= 1;
      current += char;
      continue;
    }
    if (char === separator && depth === 0) {
      parts.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

/** Klammertupel eines `VALUES`-Blocks; verschachtelte Klammern und Quotes bleiben erhalten. */
export function extractTuples(text) {
  const tuples = [];
  let depth = 0;
  let quote = null;
  let current = '';
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quote) {
      if (depth) current += char;
      if (char === quote) {
        if (text[index + 1] === quote) {
          if (depth) current += text[index + 1];
          index += 1;
        } else {
          quote = null;
        }
      }
      continue;
    }
    if (char === "'") {
      quote = char;
      if (depth) current += char;
      continue;
    }
    if (char === '(') {
      depth += 1;
      if (depth === 1) {
        current = '';
        continue;
      }
    }
    if (char === ')') {
      depth -= 1;
      if (depth === 0) {
        tuples.push(current);
        current = '';
        continue;
      }
    }
    if (depth > 0) current += char;
  }
  return tuples;
}

const literal = (value) => /^'([^']*)'$/.exec(value?.trim() ?? '')?.[1] ?? null;

const tableContexts = (sql) =>
  [...sql.matchAll(/(?:create|alter)\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?([a-z0-9_]+)"?/gi)].map((match) => ({
    table: match[1],
    index: match.index ?? 0,
  }));

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
 * CHECK-Constraints auf Statusspalten – unter Berücksichtigung von
 * `drop constraint`. Ohne die Drops würden längst entfernte Wertelisten
 * weiter als Zustände gelten (etwa `in-progress` nach dem Entfernen von
 * `tasks_status_check`). Benannte Constraints tragen ihren Namen; unbenannte
 * erhalten den von PostgreSQL vergebenen Namen `<tabelle>_<spalte>_check`.
 */
export function collectChecks(migrations) {
  const active = new Map();
  const toValues = (text) => [...(text ?? '').matchAll(/'([^']*)'/g)].map((entry) => entry[1]);

  for (const { file, sql } of migrations) {
    const contexts = tableContexts(sql);
    const events = [];

    for (const match of sql.matchAll(
      /alter\s+table\s+(?:if\s+exists\s+)?(?:public\.)?"?([a-z0-9_]+)"?\s+add\s+constraint\s+([a-z0-9_]+)\s+check\s*\(\s*([a-z0-9_]+)\s*(?:in\s*\(([^)]*)\)|=\s*any\s*\(\s*array\s*\[([^\]]*)\]\s*\))/gi,
    )) {
      events.push({
        index: match.index ?? 0,
        kind: 'add',
        table: match[1],
        name: match[2],
        column: match[3],
        values: toValues(match[4] ?? match[5]),
      });
    }

    for (const match of sql.matchAll(
      /check\s*\(\s*([a-z0-9_]+)\s*(?:in\s*\(([^)]*)\)|=\s*any\s*\(\s*array\s*\[([^\]]*)\]\s*\))/gi,
    )) {
      const index = match.index ?? 0;
      if (!isStateColumn(match[1])) continue;
      const prefix = sql.slice(Math.max(0, index - 80), index);
      if (/constraint\s+[a-z0-9_]+\s*$/i.test(prefix)) continue;
      const context = [...contexts].reverse().find((entry) => entry.index < index);
      if (!context) continue;
      events.push({
        index,
        kind: 'add',
        table: context.table,
        name: `${context.table}_${match[1]}_check`,
        column: match[1],
        values: toValues(match[2] ?? match[3]),
      });
    }

    for (const match of sql.matchAll(
      /alter\s+table\s+(?:if\s+exists\s+)?(?:public\.)?"?([a-z0-9_]+)"?\s+drop\s+constraint\s+(?:if\s+exists\s+)?([a-z0-9_]+)/gi,
    )) {
      events.push({ index: match.index ?? 0, kind: 'drop', table: match[1], name: match[2] });
    }

    events.sort((a, b) => a.index - b.index);
    for (const event of events) {
      if (event.kind === 'drop') {
        active.delete(event.name);
        continue;
      }
      if (!event.values.length) continue;
      active.set(event.name, {
        table: event.table,
        column: event.column,
        values: event.values,
        source: file,
        name: event.name,
      });
    }
  }

  return [...active.values()]
    .map(({ name: _name, ...check }) => check)
    .sort(
      (a, b) =>
        a.table.localeCompare(b.table) ||
        a.column.localeCompare(b.column) ||
        a.values.join(',').localeCompare(b.values.join(',')),
    );
}

/** Belegte Schreibvorgänge: `UPDATE <tabelle> SET <status>='x' [WHERE <status>='y'|IN (…)]`. */
export function collectWrites(migrations) {
  const writes = [];
  for (const { file, sql } of migrations) {
    for (const statement of sql.matchAll(/update\s+(?:public\.)?([a-z0-9_]+)(?:\s+(?:as\s+)?[a-z][a-z0-9_]*)?\s+set\s+([\s\S]*?)(?:;|$)/gi)) {
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

/**
 * Startzustände: Spalten-Defaults und literale INSERT-Werte. Sie belegen den
 * Eintritt in die Maschine (∅ → zustand) und ersetzen keine Übergänge.
 */
export function collectInitialStates(migrations) {
  const initial = [];
  for (const { file, sql } of migrations) {
    const contexts = tableContexts(sql);
    for (const match of sql.matchAll(
      /(?:^|[,(\s])([a-z0-9_]+)\s+[a-z][a-z0-9_ ]*(?:\([^)]*\))?\s+(?:not\s+null\s+)?default\s+'([^']*)'/gi,
    )) {
      if (!isStateColumn(match[1])) continue;
      const context = [...contexts].reverse().find((entry) => entry.index < (match.index ?? 0));
      const table = context?.table;
      if (!table) continue;
      initial.push({ table, column: match[1], value: match[2], via: 'default', source: file });
    }

    for (const match of sql.matchAll(/insert\s+into\s+(?:public\.)?"?([a-z0-9_]+)"?\s*\(([^)]*)\)\s*values\s*([\s\S]*?);/gi)) {
      const table = match[1];
      const names = splitTopLevel(match[2]).map((name) => name.replace(/"/g, '').trim().toLowerCase());
      const stateIndexes = names.map((name, index) => (isStateColumn(name) ? index : -1)).filter((index) => index >= 0);
      if (!stateIndexes.length) continue;
      for (const tuple of extractTuples(match[3])) {
        const values = splitTopLevel(tuple);
        for (const index of stateIndexes) {
          const value = literal(values[index]);
          if (value) initial.push({ table, column: names[index], value, via: 'insert', source: file });
        }
      }
    }
  }
  return initial;
}

/** Alle Funktionskörper (`create function … as $$ … $$`), unabhängig vom Rückgabetyp. */
export function collectFunctions(migrations) {
  const functions = new Map();
  for (const { file, sql } of migrations) {
    for (const match of sql.matchAll(
      /create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?([a-z0-9_]+)\s*\(([\s\S]*?)\)\s*returns\s+([a-z0-9_ ]+)[\s\S]*?as\s+\$\$([\s\S]*?)\$\$/gi,
    )) {
      functions.set(match[1], { name: match[1], args: match[2], returns: match[3].trim().toLowerCase(), body: match[4], source: file });
    }
  }
  return functions;
}

/**
 * Parametrische Schreibvorgänge: `SET <status> = _entscheidung`. Der Zielwert
 * steht nicht im SQL, sondern in der Validierung derselben Funktion
 * (`if _entscheidung not in (…) then raise`). Nur so belegte Werte werden
 * übernommen; die Herkunft bleibt unbestimmt, weil das WHERE den Ausgangszustand
 * nicht nennt.
 */
export function collectParametricWrites(migrations) {
  const writes = [];
  for (const definition of collectFunctions(migrations).values()) {
    for (const statement of definition.body.matchAll(/update\s+(?:public\.)?([a-z0-9_]+)(?:\s+(?:as\s+)?[a-z][a-z0-9_]*)?\s+set\s+([\s\S]*?)(?:;|$)/gi)) {
      const table = statement[1];
      const body = statement[2];
      const whereIndex = body.search(/\bwhere\b/i);
      const setClause = whereIndex >= 0 ? body.slice(0, whereIndex) : body;
      for (const assignment of splitTopLevel(setClause)) {
        const parsed = /^([a-z0-9_]+)\s*=\s*([\s\S]+)$/i.exec(assignment);
        if (!parsed) continue;
        const column = parsed[1].toLowerCase();
        if (!isStateColumn(column)) continue;
        const expression = parsed[2].trim();
        if (/^'/.test(expression)) continue;
        if (/^(new|old)\./i.test(expression)) continue;
        const param = /^(?:_|v_|p_)?([a-z0-9_]+)$/i.exec(expression)?.[0] ?? null;
        if (!param || param.length < 2) continue;
        const checks = [];
        for (const check of definition.body.matchAll(new RegExp(`\\b${param}\\b\\s*(not\\s+in|in)\\s*\\(([^)]*)\\)`, 'gi'))) {
          const values = [...check[2].matchAll(/'([^']*)'/g)].map((entry) => entry[1]);
          if (values.length) checks.push({ operator: check[1].toLowerCase().replace(/\s+/g, ' '), values });
        }
        const literals = [...expression.matchAll(/'([^']*)'/g)].map((entry) => entry[1]);
        writes.push({
          table,
          column,
          param,
          checks,
          literals,
          source: definition.source,
          function: definition.name,
        });
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
        message: /raise\s+exception\s+'([^']*)'/i.exec(definition.body)?.[1] ?? null,
        source: file,
        functionSource: definition.source,
      });
    }
  }
  return triggers;
}

/* ----------------------------------------------------------- Guard-Semantik */

const COMPARISONS = [
  { operator: 'not in', negated: true, pattern: 'not\\s+in\\s*\\(([^)]*)\\)', list: true },
  { operator: 'in', negated: false, pattern: '(?<!not\\s)\\bin\\s*\\(([^)]*)\\)', list: true },
  { operator: 'is distinct from', negated: true, pattern: 'is\\s+distinct\\s+from\\s*\\(?\'([^\']*)\'', list: false },
  { operator: '<>', negated: true, pattern: '<>\\s*\\(?\'([^\']*)\'', list: false },
  { operator: '!=', negated: true, pattern: '!=\\s*\\(?\'([^\']*)\'', list: false },
  { operator: '=', negated: false, pattern: '=\\s*\\(?\'([^\']*)\'', list: false },
];

/**
 * Vergleiche eines Guard-Körpers für eine Spalte, mit Polarität und Seite.
 * `negated` heißt: die Bedingung schließt diese Werte aus. Die Umrechnung in
 * erlaubte/blockierte Zustände braucht die Zustandsliste und passiert erst
 * beim Zusammenbau der Maschine.
 */
export function guardChecks(body, column) {
  const checks = [];
  for (const side of ['OLD', 'NEW']) {
    for (const comparison of COMPARISONS) {
      const pattern = new RegExp(`\\b${side.toLowerCase()}\\.${column}\\b\\s*${comparison.pattern}`, 'gi');
      for (const match of body.matchAll(pattern)) {
        const values = comparison.list
          ? [...match[1].matchAll(/'([^']*)'/g)].map((entry) => entry[1])
          : [match[1]];
        const cleaned = values.filter(Boolean);
        if (!cleaned.length) continue;
        checks.push({ side, operator: comparison.operator, negated: comparison.negated, values: [...new Set(cleaned)].sort() });
      }
    }
  }
  return checks;
}

/** Aufsummierte Zustandswerte eines Guards (Anzeige-Kompatibilität). */
function guardStates(body, column) {
  return [...new Set(guardChecks(body, column).flatMap((check) => check.values))].sort();
}

/**
 * Blockierte Zustände eines abbrechenden Guards. Beobachter blockieren nichts.
 * `negated`-Vergleiche blockieren alle Zustände außer den genannten.
 */
export function blockedStates(guard, states) {
  const blockedTo = new Set();
  const blockedFrom = new Set();
  if (!guard.raises) return { blockedTo: [], blockedFrom: [] };
  for (const check of guard.checks) {
    const target = check.side === 'NEW' ? blockedTo : blockedFrom;
    if (check.negated) {
      for (const state of states) if (!check.values.includes(state)) target.add(state);
    } else {
      for (const value of check.values) target.add(value);
    }
  }
  return { blockedTo: [...blockedTo].sort(), blockedFrom: [...blockedFrom].sort() };
}

/* -------------------------------------------------- TS- und Client-Abgleich */

/** Handgepflegte Übergangstabellen aus registrierten TS-Modulen. */
export function collectTsTransitions(root, sources = TS_STATE_SOURCES) {
  const collected = [];
  for (const source of sources) {
    const path = join(root, source.file);
    if (!existsSync(path)) continue;
    const parsed = ts.createSourceFile(source.file, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true);
    for (const statement of parsed.statements) {
      if (!ts.isVariableStatement(statement)) continue;
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name) || declaration.name.text !== source.exportName) continue;
        if (!declaration.initializer || !ts.isObjectLiteralExpression(declaration.initializer)) continue;
        const transitions = [];
        for (const property of declaration.initializer.properties) {
          if (!ts.isPropertyAssignment(property)) continue;
          const from = memberName(property);
          if (!from || !ts.isArrayLiteralExpression(property.initializer)) continue;
          for (const element of property.initializer.elements) {
            if (ts.isStringLiteral(element)) transitions.push({ from, to: element.text });
          }
        }
        if (transitions.length) collected.push({ ...source, transitions });
      }
    }
  }
  return collected;
}

/**
 * Übergangsregeln, die sowohl als TS-Matrix als auch als Datenbanktabelle
 * existieren. Der Seed der Tabelle muss der Matrix entsprechen; sonst prüft die
 * Datenbank andere Kanten als der Client.
 */
export const TRANSITION_SEED_SPECS = [
  {
    machine: 'letters.status',
    table: 'letter_status_transitions',
    fromColumn: 'from_status',
    toColumn: 'to_status',
  },
];

/** Kanten aus `INSERT INTO <tabelle> (from, to) VALUES (…)` in den Migrationen. */
export function collectTransitionSeeds(migrations, spec) {
  const pairs = new Set();
  const pattern = new RegExp(
    `insert\\s+into\\s+(?:public\\.)?${spec.table}\\s*\\(([^)]*)\\)\\s*values\\s*([\\s\\S]*?);`,
    'gi',
  );
  for (const { sql } of migrations) {
    for (const match of sql.matchAll(pattern)) {
      const names = splitTopLevel(match[1]).map((name) => name.replace(/"/g, '').trim().toLowerCase());
      const fromIndex = names.indexOf(spec.fromColumn);
      const toIndex = names.indexOf(spec.toColumn);
      if (fromIndex < 0 || toIndex < 0) continue;
      for (const tuple of extractTuples(match[2])) {
        const values = splitTopLevel(tuple);
        const from = literal(values[fromIndex]);
        const to = literal(values[toIndex]);
        if (from && to) pairs.add(`${from}->${to}`);
      }
    }
  }
  return pairs;
}

/** Abgleich zwischen TS-Matrix und Datenbank-Seed; beide Richtungen sind Fehler. */
export function compareTransitionSeeds({ migrations, tsSources, specs = TRANSITION_SEED_SPECS }) {
  const errors = [];
  for (const spec of specs) {
    const source = tsSources.find((entry) => entry.machine === spec.machine);
    if (!source) {
      errors.push(`${spec.machine}: kein TS-Regelmodul für ${spec.table} registriert`);
      continue;
    }
    const seeds = collectTransitionSeeds(migrations, spec);
    if (!seeds.size) {
      errors.push(`${spec.machine}: ${spec.table} enthält keinen Seed`);
      continue;
    }
    const code = new Set(source.transitions.map((entry) => `${entry.from}->${entry.to}`));
    for (const pair of code) {
      if (!seeds.has(pair)) errors.push(`${spec.machine}: ${pair} fehlt in ${spec.table}`);
    }
    for (const pair of seeds) {
      if (!code.has(pair)) errors.push(`${spec.machine}: ${pair} steht in ${spec.table}, nicht in ${source.exportName}`);
    }
  }
  return errors;
}

const CLIENT_SKIP = /(^|\/)(node_modules|dist|build|generated|__tests__)(\/|$)|\.(test|spec)\.[tj]sx?$/;

function walkFiles(directory, files = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (CLIENT_SKIP.test(`/${path.replace(/\\/g, '/')}`)) continue;
    if (entry.isDirectory()) walkFiles(path, files);
    else if (/\.(ts|tsx)$/.test(entry.name)) files.push(path);
  }
  return files;
}

/** Objektkörper ab `{` bis zur passenden `}` (Quotes werden respektiert). */
function objectAt(text, start) {
  let depth = 0;
  let quote = null;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (quote) {
      if (char === quote && text[index - 1] !== '\\') quote = null;
      continue;
    }
    if (char === "'" || char === '"' || char === '`') {
      quote = char;
      continue;
    }
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(start + 1, index);
    }
  }
  return null;
}

/**
 * Client-Schreibvorgänge: `from('tabelle')…update({ status: 'x' })`. Nur
 * Literale zählen; Variablen und Spreads bleiben unbestimmt. Das ist ein
 * Abgleich, kein Beweis – der Client kann jederzeit an der DB-Vorbeiführung
 * scheitern.
 */
export function collectClientWrites(root, directory = 'src') {
  const target = join(root, directory);
  if (!existsSync(target) || !statSync(target).isDirectory()) return [];
  const writes = [];
  for (const file of walkFiles(target)) {
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(/\.from\(\s*['"]([a-z0-9_]+)['"]\s*\)/gi)) {
      const table = match[1];
      const tail = text.slice(match.index ?? 0, (match.index ?? 0) + 2400);
      const update = /[\s\S]{0,400}?\.update\(\s*\{/i.exec(tail);
      if (!update) continue;
      const braceIndex = (match.index ?? 0) + update.index + update[0].length - 1;
      const body = objectAt(text, braceIndex);
      if (!body) continue;
      for (const assignment of splitTopLevel(body)) {
        const parsed = /^['"]?([a-z0-9_]+)['"]?\s*:\s*'([^']*)'$/i.exec(assignment);
        if (!parsed || !isStateColumn(parsed[1])) continue;
        writes.push({ table, column: parsed[1].toLowerCase(), value: parsed[2], source: `${directory}/${file.slice(target.length + 1)}` });
      }
    }
  }
  return writes;
}

/* ------------------------------------------------------------------ Artefakt */

const SOURCE_ORDER = ['enum', 'check', 'default', 'insert', 'write', 'param', 'guard'];

function addState(index, machineId, value, source) {
  if (!value) return;
  const machine = index.get(machineId);
  if (!machine) return;
  if (!machine.states.has(value)) machine.states.set(value, new Set());
  machine.states.get(value).add(source);
}

/** Belegte Übergänge eines Zustands, unabhängig von der Herkunft. */
function addTransition(machine, transition) {
  const key = `${transition.kind}:${(transition.from ?? []).join(',')}->${transition.to}`;
  if (!machine.transitions.has(key)) {
    machine.transitions.set(key, { ...transition, sources: new Set(transition.sources) });
  } else {
    for (const source of transition.sources) machine.transitions.get(key).sources.add(source);
  }
}

/**
 * Befunde aus dem fertigen Graphen. Reine Funktion, damit die Regeln testbar
 * bleiben und nicht in der Oberfläche verstreut liegen.
 */
export function analyzeMachine(machine) {
  const findings = [];
  const values = machine.states.map((state) => state.value);
  const known = new Set(values);
  const initial = new Set(machine.initialStates);
  const incoming = new Set();
  for (const transition of machine.transitions) {
    if (known.has(transition.to)) incoming.add(transition.to);
  }
  const outgoing = new Set();
  for (const transition of machine.transitions) {
    for (const from of transition.from ?? []) if (known.has(from)) outgoing.add(from);
  }

  if (!machine.initialStates.length) {
    findings.push({
      kind: 'kein-startzustand',
      severity: 'warn',
      states: [],
      message: 'Kein Spalten-Default und kein literaler INSERT belegt einen Startzustand.',
    });
  }

  const graphFindings = machine.transitions.length > 0;

  const unreachable = graphFindings ? values.filter((value) => !initial.has(value) && !incoming.has(value)) : [];
  const graphIsComplete = machine.transitions.some((transition) => transition.kind === 'write' && transition.from !== null);
  if (unreachable.length) {
    findings.push({
      kind: 'unerreichbar',
      severity: graphIsComplete ? 'warn' : 'info',
      states: unreachable.sort(),
      message: graphIsComplete
        ? 'Zustände ohne belegten Eingang: weder Startzustand noch Ziel eines Übergangs.'
        : 'Zustände ohne belegten Eingang; der Graph enthält noch keinen Übergang mit Ausgangszustand, daher keine Aussage über Erreichbarkeit.',
    });
  }

  const isolated = graphFindings
    ? values.filter((value) => !initial.has(value) && !incoming.has(value) && !outgoing.has(value))
    : [];
  if (isolated.length) {
    findings.push({
      kind: 'isoliert',
      severity: 'info',
      states: isolated.sort(),
      message: 'Zustände ohne jede Verbindung im belegten Graphen.',
    });
  }

  const sinks = graphFindings ? values.filter((value) => incoming.has(value) && !outgoing.has(value)) : [];
  if (sinks.length) {
    findings.push({
      kind: 'sackgasse',
      severity: 'info',
      states: sinks.sort(),
      message: 'Zustände mit Eingang, aber ohne belegten ausgehenden Übergang (möglicher Endzustand).',
    });
  }

  const guardOnly = values.filter((value) => {
    const sources = machine.states.find((state) => state.value === value)?.sources ?? [];
    return sources.length > 0 && sources.every((source) => source.startsWith('guard:'));
  });
  if (guardOnly.length) {
    findings.push({
      kind: 'nur-im-guard',
      severity: 'info',
      states: guardOnly.sort(),
      message: 'Zustandswerte stammen ausschließlich aus Trigger-Vergleichen, aus keinem Schreibvorgang.',
    });
  }

  const unproven = machine.transitions.filter((transition) => transition.kind === 'write' && transition.from === null);
  if (unproven.length) {
    findings.push({
      kind: 'unbelegter-start',
      severity: 'info',
      states: [...new Set(unproven.map((transition) => transition.to))].sort(),
      message: 'Schreibvorgänge ohne belegten Ausgangszustand; die Kante bleibt gerichtet, aber ohne Quelle.',
    });
  }

  const parametric = machine.transitions.filter((transition) => transition.kind === 'parametric');
  if (parametric.length) {
    findings.push({
      kind: 'parametrisch',
      severity: 'info',
      states: [...new Set(parametric.map((transition) => transition.to))].sort(),
      message: `Zielwerte stammen aus Funktionsparametern (${[...new Set(parametric.map((transition) => transition.param))].join(', ')}); der Ausgangszustand ist im SQL nicht benannt.`,
    });
  }

  for (const guard of machine.guards) {
    if (!guard.raises) continue;
    if (!guard.allowedTo.length) {
      findings.push({
        kind: 'guard-widerspruch',
        severity: 'warn',
        states: guard.blockedTo,
        message: `${guard.trigger} blockiert jeden belegten Zielzustand.`,
      });
    }
  }

  const clientValues = machine.reconciliation?.clientValues ?? [];
  const unbacked = [...new Set(clientValues.map((entry) => entry.value))].filter((value) => !known.has(value));
  if (unbacked.length) {
    findings.push({
      kind: 'client-wert-unbelegt',
      severity: 'warn',
      states: unbacked.sort(),
      message: 'Der Client schreibt Zustandswerte, die in Migrationen oder Typen nicht belegt sind.',
    });
  }

  const missingValues = machine.reconciliation?.valuesNotInDatabase ?? [];
  if (missingValues.length) {
    findings.push({
      kind: 'nur-im-code',
      severity: 'warn',
      states: missingValues,
      message: `${machine.reconciliation.label} erlaubt Zustände, die in der Datenbank nicht belegt sind.`,
    });
  } else if (machine.reconciliation?.onlyInCode.length) {
    findings.push({
      kind: 'kanten-nicht-belegt',
      severity: 'info',
      states: [...new Set(machine.reconciliation.onlyInCode.map((entry) => entry.to))].sort(),
      message:
        'TS-Regeln erlauben Übergänge, die kein Migrationsschreibvorgang belegt; bei benutzergesteuerten Wechseln ist das erwartbar.',
    });
  }
  if (machine.reconciliation?.onlyInArtifact.length) {
    findings.push({
      kind: 'nur-in-der-datenbank',
      severity: 'info',
      states: [...new Set(machine.reconciliation.onlyInArtifact.map((entry) => entry.to))].sort(),
      message: 'Die Datenbank kennt Übergänge, die das TS-Regelmodul nicht erlaubt.',
    });
  }

  return findings.sort(
    (a, b) => (a.severity === b.severity ? a.kind.localeCompare(b.kind) : a.severity === 'warn' ? -1 : 1) || a.kind.localeCompare(b.kind),
  );
}

/**
 * Baut das Artefakt aus den übergebenen Quellen. Reine Funktion ohne Dateizugriff,
 * damit die Ableitung testbar bleibt.
 */
export function buildStateArtifact({ typesSource, migrations, typesFile = TYPES_FILE, tsSources = [], clientWrites = [] }) {
  const { enums, columns } = parseGeneratedTypes(typesSource, typesFile);
  const enumDefinitions = collectEnumDefinitions(migrations);
  const checks = collectChecks(migrations);
  const initialStates = collectInitialStates(migrations);
  const writes = collectWrites(migrations);
  const parametricWrites = collectParametricWrites(migrations);
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
      initial: new Set(),
      transitions: new Map(),
      guards: new Map(),
    });
  }

  for (const column of columns) {
    if (!column.enumName) continue;
    const machine = machines.get(`${column.table}.${column.column}`);
    const fromTypes = enums.get(column.enumName);
    const definition = enumDefinitions.get(column.enumName);
    const values = Array.isArray(fromTypes) ? fromTypes : definition?.values ?? [];
    for (const value of values) addState(machines, machine.id, value, `enum:${column.enumName}`);
  }

  for (const check of checks) {
    const id = `${check.table}.${check.column}`;
    if (!known.has(id)) continue;
    for (const value of check.values) addState(machines, id, value, `check:${check.source}`);
  }

  for (const entry of initialStates) {
    const id = `${entry.table}.${entry.column}`;
    const machine = machines.get(id);
    if (!machine) continue;
    addState(machines, id, entry.value, `${entry.via === 'insert' ? 'insert' : 'default'}:${entry.source}`);
    machine.initial.add(entry.value);
    addTransition(machine, { from: null, to: entry.value, kind: 'initial', param: null, sources: [entry.source] });
  }

  for (const write of writes) {
    const id = `${write.table}.${write.column}`;
    const machine = machines.get(id);
    if (!machine) continue;
    addState(machines, id, write.to, `write:${write.source}`);
    for (const from of write.from) addState(machines, id, from, `write:${write.source}`);
    addTransition(machine, {
      from: write.from.length ? write.from : null,
      to: write.to,
      kind: 'write',
      param: null,
      sources: [write.source],
    });
  }

  for (const write of parametricWrites) {
    const id = `${write.table}.${write.column}`;
    const machine = machines.get(id);
    if (!machine) continue;
    const values = new Set(write.literals);
    // `if _status not in (…) then raise` listet die zulässigen Werte; ein `in`
    // ohne Abbruch listet zumindest die im Code unterschiedenen Werte.
    const rejecting = write.checks.filter((check) => check.operator === 'not in');
    const allowing = write.checks.filter((check) => check.operator === 'in');
    for (const check of rejecting.length ? rejecting : allowing) {
      for (const value of check.values) values.add(value);
    }
    for (const value of values) {
      addState(machines, id, value, `param:${write.source}`);
      addTransition(machine, { from: null, to: value, kind: 'parametric', param: write.param, sources: [write.source] });
    }
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
      if (machine.guards.has(trigger.trigger)) continue;
      const readsOld = /\bold\./i.test(trigger.body);
      const readsNew = /\bnew\./i.test(trigger.body);
      machine.guards.set(trigger.trigger, {
        trigger: trigger.trigger,
        function: trigger.function,
        timing: trigger.timing,
        events: trigger.events,
        source: trigger.source,
        functionSource: trigger.functionSource,
        // Nur Funktionen, die bei Zustandsverstößen abbrechen, sind Guards.
        // Trigger ohne RAISE EXCEPTION beobachten oder synchronisieren nur.
        kind: trigger.raises && (readsOld || readsNew) ? 'guard' : 'trigger',
        readsOld: readsOld || trigger.readsOld === true,
        readsNew: readsNew || trigger.readsNew === true,
        raises: trigger.raises,
        message: trigger.message,
        checks: guardChecks(trigger.body, column.column),
        states,
      });
    }
  }

  const tsIndex = new Map(tsSources.map((source) => [source.machine, source]));
  const clientIndex = new Map();
  for (const write of clientWrites) {
    const id = `${write.table}.${write.column}`;
    if (!clientIndex.has(id)) clientIndex.set(id, []);
    clientIndex.get(id).push({ value: write.value, source: write.source });
  }

  const renderedMachines = [];
  const unresolved = [];
  for (const machine of machines.values()) {
    if (machine.states.size === 0) {
      unresolved.push({ table: machine.table, column: machine.column, reason: 'keine belegten Zustandswerte' });
      continue;
    }
    const stateValues = [...machine.states.keys()].sort();
    const states = stateValues.map((value) => ({ value, sources: [...machine.states.get(value)].sort(compareSources) }));

    const transitions = [...machine.transitions.values()]
      .map((transition) => ({
        from: transition.from,
        to: transition.to,
        kind: transition.kind,
        param: transition.param ?? null,
        sources: [...transition.sources].sort(),
      }))
      .sort(
        (a, b) =>
          String(a.from).localeCompare(String(b.from)) ||
          a.to.localeCompare(b.to) ||
          a.kind.localeCompare(b.kind) ||
          a.sources.join(',').localeCompare(b.sources.join(',')),
      );

    const guards = [...machine.guards.values()]
      .map((guard) => {
        const blocked = blockedStates(guard, stateValues);
        return {
          ...guard,
          blockedTo: blocked.blockedTo,
          blockedFrom: blocked.blockedFrom,
          allowedTo: stateValues.filter((value) => !blocked.blockedTo.includes(value)),
          allowedFrom: stateValues.filter((value) => !blocked.blockedFrom.includes(value)),
        };
      })
      .sort((a, b) => a.trigger.localeCompare(b.trigger));

    for (const transition of transitions) {
      transition.guards = guards
        .filter(
          (guard) =>
            (guard.blockedTo.length && guard.blockedTo.includes(transition.to)) ||
            (transition.from ?? []).some((from) => guard.blockedFrom.includes(from)),
        )
        .map((guard) => guard.trigger);
    }

    const reconciliationSource = tsIndex.get(machine.id);
    const uniqueClientValues = new Map();
    for (const entry of clientIndex.get(machine.id) ?? []) {
      uniqueClientValues.set(`${entry.value}\u0000${entry.source}`, entry);
    }
    const clientValues = [...uniqueClientValues.values()].sort(
      (a, b) => a.value.localeCompare(b.value) || a.source.localeCompare(b.source),
    );
    let reconciliation = null;
    if (reconciliationSource || clientValues.length) {
      const pairs = new Set(
        transitions
          .filter((transition) => transition.kind === 'write' && transition.from)
          .flatMap((transition) => transition.from.map((from) => `${from}->${transition.to}`)),
      );
      const codePairs = reconciliationSource
        ? reconciliationSource.transitions.map((entry) => `${entry.from}->${entry.to}`)
        : [];
      // Echte Abweichung ist ein Zustandswert, den die Datenbank nicht kennt –
      // nicht jede Kante ohne Migrationsschreibvorgang (benutzergesteuerte
      // Wechsel schreibt der Client).
      const tsValues = new Set(
        reconciliationSource
          ? reconciliationSource.transitions.flatMap((entry) => [entry.from, entry.to])
          : [],
      );
      reconciliation = {
        source: reconciliationSource?.file ?? null,
        label: reconciliationSource?.label ?? null,
        valuesNotInDatabase: [...tsValues].filter((value) => !stateValues.includes(value)).sort(),
        onlyInCode: reconciliationSource
          ? reconciliationSource.transitions.filter((entry) => !pairs.has(`${entry.from}->${entry.to}`))
          : [],
        onlyInArtifact: reconciliationSource
          ? [...pairs].filter((pair) => !codePairs.includes(pair)).map((pair) => {
              const [from, to] = pair.split('->');
              return { from, to };
            })
          : [],
        clientValues,
      };
    }

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
    if (transitions.some((transition) => transition.kind === 'write' && transition.from === null)) {
      limitations.push('Übergänge ohne belegten Ausgangszustand sind mit "from": null gekennzeichnet.');
    }
    if (!machine.initial.size) {
      limitations.push('Kein Startzustand belegt; der Eintritt in die Maschine ist nicht nachweisbar.');
    }

    const rendered = {
      id: machine.id,
      table: machine.table,
      column: machine.column,
      enumType: machine.enumType,
      states,
      initialStates: [...machine.initial].sort(),
      transitions,
      guards,
      reconciliation,
      limitations,
      findings: [],
    };
    rendered.findings = analyzeMachine(rendered);
    renderedMachines.push(rendered);
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
    version: 2,
    generatedBy: 'scripts/build-state-artifact.mjs',
    description:
      'Abgeleitetes Zustandsartefakt. Zustände stammen aus Enum-Typen, CHECK-Constraints, Defaults, INSERTs, belegten UPDATE-Schreibvorgängen und Guard-Vergleichen; Übergänge aus Schreibvorgängen, Startzuständen und parametrischen Funktionswerten. Guards tragen ihre geprüften Werte und blockierten Zustände. Befunde und Abgleich mit TS-Regelmodulen und Client-Schreibvorgängen sind berechnet, nicht gepflegt.',
    sources: {
      types: typesFile,
      migrationsDirectory: MIGRATIONS_DIR,
      migrationCount: migrations.length,
      tsModules: tsSources.map((source) => source.file),
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

export function collectSources(root) {
  return {
    ...readSources(root),
    typesFile: TYPES_FILE,
    tsSources: collectTsTransitions(root),
    clientWrites: collectClientWrites(root),
  };
}

export function renderArtifact(root) {
  const sources = collectSources(root);
  const artifact = buildStateArtifact(sources);
  const errors = [...compareTransitionSeeds(sources), ...validateArtifact(artifact, root)];
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
    for (const state of machine.initialStates ?? []) {
      if (!known.has(state)) errors.push(`${machine.id}: Startzustand ${state} ist kein belegter Zustand`);
    }
    for (const transition of machine.transitions) {
      if (!['write', 'initial', 'parametric'].includes(transition.kind)) {
        errors.push(`${machine.id}: Übergang ${transition.to} hat keine gültige Art (${transition.kind})`);
      }
      if (transition.kind === 'initial' && transition.from !== null) {
        errors.push(`${machine.id}: Startzustand ${transition.to} darf keinen Ausgangszustand haben`);
      }
      if (!known.has(transition.to)) errors.push(`${machine.id}: Zielzustand ${transition.to} ist kein belegter Zustand`);
      for (const from of transition.from ?? []) {
        if (!known.has(from)) errors.push(`${machine.id}: Ausgangszustand ${from} ist kein belegter Zustand`);
      }
      for (const source of transition.sources) {
        if (!existsSync(join(root, source))) errors.push(`${machine.id}: Quelle fehlt: ${source}`);
      }
      for (const guard of transition.guards ?? []) {
        if (!machine.guards.some((entry) => entry.trigger === guard)) {
          errors.push(`${machine.id}: Übergang ${transition.to} verweist auf unbekannten Guard ${guard}`);
        }
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
      for (const value of [...(guard.blockedTo ?? []), ...(guard.allowedTo ?? [])]) {
        if (!known.has(value)) errors.push(`${machine.id}: Guard ${guard.trigger} nennt unbekannten Zustand ${value}`);
      }
    }
    if (machine.reconciliation?.source && !existsSync(join(root, machine.reconciliation.source))) {
      errors.push(`${machine.id}: Abgleichquelle fehlt: ${machine.reconciliation.source}`);
    }
  }
  return errors;
}

function printAudit(artifact) {
  const allGuards = artifact.machines.flatMap((machine) => machine.guards);
  const findings = artifact.machines.flatMap((machine) => machine.findings);
  const drift = artifact.machines.filter((machine) => machine.reconciliation);
  console.log('[state-artifact:audit]');
  console.log(`  Statusspalten:         ${artifact.machineCount + artifact.unresolved.length}`);
  console.log(`  Zustandsmaschinen:     ${artifact.machineCount}`);
  console.log(`  ohne belegte Zustände: ${artifact.unresolved.length}`);
  console.log(`  Startzustände:         ${artifact.machines.reduce((sum, machine) => sum + machine.initialStates.length, 0)}`);
  console.log(`  Übergänge:             ${artifact.machines.reduce((sum, machine) => sum + machine.transitions.length, 0)}`);
  console.log(`  Guards (Abbruch):      ${allGuards.filter((guard) => guard.kind === 'guard').length}`);
  console.log(`  Trigger (beobachtend): ${allGuards.filter((guard) => guard.kind === 'trigger').length}`);
  console.log(`  Befunde (Warnung):     ${findings.filter((finding) => finding.severity === 'warn').length}`);
  console.log(`  Befunde (Hinweis):     ${findings.filter((finding) => finding.severity === 'info').length}`);
  console.log(`  Abgleich:              ${drift.length} Maschinen mit TS-/Client-Bezug`);
  console.log(`  Schreibweisen-Befunde: ${artifact.anomalies.length}`);
  for (const machine of artifact.machines) {
    console.log(
      `    ${machine.id}: ${machine.states.length} Zustände, ${machine.transitions.length} Übergänge, ${machine.guards.length} Guards, ${machine.findings.length} Befunde`,
    );
  }
  for (const entry of artifact.unresolved) console.log(`    offen: ${entry.table}.${entry.column} (${entry.reason})`);
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  const root = process.cwd();
  const sources = collectSources(root);
  const artifact = buildStateArtifact(sources);
  const errors = [...compareTransitionSeeds(sources), ...validateArtifact(artifact, root)];
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
    findings: artifact.machines.reduce((sum, machine) => sum + machine.findings.length, 0),
    errors: errors.length,
  });
  for (const error of errors) console.error(error);
  process.exitCode = errors.length ? 1 : 0;
}
