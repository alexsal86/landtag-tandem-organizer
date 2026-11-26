#!/usr/bin/env node
// Prüft, dass eine Edge Function beim Schreiben nur Spalten anspricht, die in
// den generierten Supabase-Typen (Row-Block) existieren.
//
// PostgREST weist eine unbekannte Spalte mit PGRST204 ab; die Funktion antwortet
// dann nur noch mit einem generischen 500. Weil nichts diesen Abgleich geprüft
// hat, schrieb archive-letter lange `letters.archived_at`/`archived_by` – zwei
// Spalten, die es nie gab, und jede Briefarchivierung endete mit 500.
//
// Bewusst klein: geprüft werden alle Edge Functions unter supabase/functions,
// nur wörtliche Objekte in insert/update/upsert und keine Lesepfade (select).
// Wer eine Spalte ergänzt, ergänzt sie in einer Migration und generiert die
// Typen neu; beides bleibt damit sichtbar.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

export const TYPES_FILE = 'src/integrations/supabase/types.ts';
export const FUNCTIONS_ROOT = 'supabase/functions';

/** Alle Edge Functions im Verzeichnis – bewusst ohne Ausnahmeliste. */
export function listFunctions(root = process.cwd()) {
  const base = join(root, FUNCTIONS_ROOT);
  return readdirSync(base, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && !entry.name.startsWith('_'))
    .filter(entry => existsSync(join(base, entry.name, 'index.ts')))
    .map(entry => entry.name)
    .sort();
}

// Geprüft wird jede Funktion des Verzeichnisses; ergänzt eine neue Funktion
// eine Spalte, fällt das ohne Änderung an dieser Liste auf.
export const CHECKED_FUNCTIONS = listFunctions();

const WRITE_METHODS = new Set(['insert', 'update', 'upsert']);

const name = (node, sourceFile) => (node?.name ? node.name.getText(sourceFile) : undefined);

/** Spalten je Tabelle aus dem Row-Block der generierten Database-Typen. */
export function parseTableColumns(source, fileName = TYPES_FILE) {
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true);
  const tables = new Map();
  const visit = node => {
    if (ts.isPropertySignature(node) && name(node, sourceFile) === 'Tables' && node.type && ts.isTypeLiteralNode(node.type)) {
      for (const table of node.type.members) {
        if (!ts.isPropertySignature(table) || !table.type || !ts.isTypeLiteralNode(table.type)) continue;
        const row = table.type.members.find(member => ts.isPropertySignature(member) && name(member, sourceFile) === 'Row');
        if (!row?.type || !ts.isTypeLiteralNode(row.type)) continue;
        tables.set(name(table, sourceFile), new Set(row.type.members.filter(ts.isPropertySignature).map(member => name(member, sourceFile))));
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return tables;
}

/** Sucht in der Aufrufkette den Tabellennamen von `.from('…')`. */
function tableOfCall(expression, sourceFile) {
  let node = expression;
  while (node) {
    if (ts.isPropertyAccessExpression(node)) {
      if (node.name.getText(sourceFile) === 'from') return undefined;
      node = node.expression;
      continue;
    }
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      if (ts.isPropertyAccessExpression(callee) && callee.name.getText(sourceFile) === 'from') {
        const target = node.arguments[0];
        return target && ts.isStringLiteralLike(target) ? target.text : undefined;
      }
      node = callee;
      continue;
    }
    return undefined;
  }
  return undefined;
}

/** Feldnamen der geschriebenen Zeilen; nicht wörtliche Angaben werden übersprungen. */
function writtenKeys(node) {
  const rows = ts.isArrayLiteralExpression(node) ? node.elements : [node];
  const keys = [];
  for (const row of rows) {
    if (!ts.isObjectLiteralExpression(row)) return [];
    for (const property of row.properties) {
      if (!ts.isPropertyAssignment(property) && !ts.isShorthandPropertyAssignment(property)) continue;
      const key = property.name?.getText().replace(/^['"](.*)['"]$/, '$1');
      if (key) keys.push(key);
    }
  }
  return keys;
}

/** Alle Schreibzugriffe auf unbekannte Spalten in einer Edge Function. */
export function collectColumnViolations(source, fileName, tableColumns) {
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true);
  const violations = [];
  const visit = node => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      WRITE_METHODS.has(node.expression.name.getText(sourceFile)) &&
      node.arguments.length > 0
    ) {
      const method = node.expression.name.getText(sourceFile);
      const table = tableOfCall(node.expression.expression, sourceFile);
      const columns = table ? tableColumns.get(table) : undefined;
      if (!columns) {
        ts.forEachChild(node, visit);
        return;
      }
      for (const column of writtenKeys(node.arguments[0])) {
        if (!columns.has(column)) violations.push({ file: fileName, table, method, column });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return violations;
}

/** Liest Typen und die geprüften Edge Functions und liefert die Verstöße. */
export function collectReport(root = process.cwd(), functions = listFunctions(root)) {
  const tableColumns = parseTableColumns(readFileSync(join(root, TYPES_FILE), 'utf8'));
  const files = functions.map(entry => `${FUNCTIONS_ROOT}/${entry}/index.ts`);
  const violations = [];
  for (const file of files) {
    let source;
    try {
      source = readFileSync(join(root, file), 'utf8');
    } catch {
      violations.push({ file, table: '—', method: '—', column: 'Funktion nicht gefunden' });
      continue;
    }
    violations.push(...collectColumnViolations(source, file, tableColumns));
  }
  return { files, violations };
}

export function renderReport({ files, violations }) {
  const lines = [`Geprüfte Edge Functions: ${files.length}`];
  for (const violation of violations) {
    lines.push(`${violation.file}: ${violation.method} auf ${violation.table} schreibt unbekannte Spalte "${violation.column}"`);
  }
  if (violations.length > 0) {
    lines.push('Spalte in einer Migration anlegen oder den Schreibzugriff entfernen und die Typen neu generieren.');
  }
  return lines.join('\n');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const report = collectReport();
  console.log(`[edge-function-columns] ${renderReport(report)}`);
  process.exitCode = report.violations.length > 0 ? 1 : 0;
}
