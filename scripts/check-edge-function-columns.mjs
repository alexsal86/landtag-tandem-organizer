#!/usr/bin/env node
// Prüft, dass Edge Functions und ihre geteilten Module beim Schreiben nur
// Spalten ansprechen, die in den generierten Supabase-Typen existieren – und
// beim Insert alle Pflichtspalten mitgeben.
//
// PostgREST weist eine unbekannte Spalte mit PGRST204 und eine fehlende
// Pflichtspalte mit 23502 ab; die Funktion antwortet dann nur noch generisch.
// Genau das blieb lange unentdeckt, weil Seed-Zeilen in
// supabase/functions/_shared entstehen (safeInsert + Builder) und nicht als
// wörtliches Objekt an `.from('…').insert(…)` hängen.
//
// Deshalb prüft der Check jetzt:
// - jede Edge Function (index.ts) und jedes geteilte Modul (_shared/*.ts),
// - wörtliche Schreibzugriffe ebenso wie `safeInsert(client, "tabelle", zeilen)`,
// - Zeilen aus Array-Literalen, `.map(…)`, Spreads und Funktionen/Variablen
//   derselben Datei,
// - Pflichtspalten aus dem Insert-Block der generierten Typen.
// Was sich nicht auflösen lässt (echt dynamische Zeilen, Tabellenparameter),
// wird als Warnung mit Datei und Zeile ausgewiesen statt still übergangen.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

export const TYPES_FILE = 'src/integrations/supabase/types.ts';
export const FUNCTIONS_ROOT = 'supabase/functions';
export const SHARED_ROOT = 'supabase/functions/_shared';

/**
 * Kernstatus aus `public.core_task_status_keys()` (Migration 20261126130000)
 * und `src/components/tasks/types.ts`. `enforce_task_status` lehnt jeden Wert
 * ab, der nicht in `task_statuses` steht (22023 „Unbekannter Aufgabenstatus“).
 * Die Liste ist bewusst hier dupliziert: Der Checker läuft als .mjs ohne
 * TS-Import; ein Test hält beide Listen deckungsgleich.
 */
export const CORE_TASK_STATUS_KEYS = ['todo', 'in_progress', 'completed', 'cancelled', 'review'];
const CORE_TASK_STATUS_HINT = CORE_TASK_STATUS_KEYS.join(', ');

/** Alle Edge Functions im Verzeichnis – bewusst ohne Ausnahmeliste. */
export function listFunctions(root = process.cwd()) {
  const base = join(root, FUNCTIONS_ROOT);
  return readdirSync(base, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && !entry.name.startsWith('_'))
    .filter(entry => existsSync(join(base, entry.name, 'index.ts')))
    .map(entry => entry.name)
    .sort();
}

/** Alle geteilten Module, die von mehreren Funktionen importiert werden. */
export function listSharedModules(root = process.cwd()) {
  const base = join(root, SHARED_ROOT);
  if (!existsSync(base)) return [];
  return readdirSync(base, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts'))
    .map(entry => entry.name)
    .sort();
}

export const CHECKED_FUNCTIONS = listFunctions();

const WRITE_METHODS = new Set(['insert', 'update', 'upsert']);
const ROW_HELPERS = new Set(['safeInsert']);

const name = (node, sourceFile) => (node?.name ? node.name.getText(sourceFile) : undefined);

/** Spalten je Tabelle aus dem Row-Block der generierten Database-Typen. */
export function parseTableColumns(source, fileName = TYPES_FILE) {
  return parseTableMembers('Row', source, fileName);
}

/** Pflichtspalten je Tabelle aus dem Insert-Block (Schlüssel ohne `?`). */
export function parseTableInsertRequirements(source, fileName = TYPES_FILE) {
  return parseTableMembers('Insert', source, fileName, member => !member.questionToken);
}

function parseTableMembers(block, source, fileName, keep = () => true) {
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true);
  const tables = new Map();
  const visit = node => {
    if (ts.isPropertySignature(node) && name(node, sourceFile) === 'Tables' && node.type && ts.isTypeLiteralNode(node.type)) {
      for (const table of node.type.members) {
        if (!ts.isPropertySignature(table) || !table.type || !ts.isTypeLiteralNode(table.type)) continue;
        const target = table.type.members.find(member => ts.isPropertySignature(member) && name(member, sourceFile) === block);
        if (!target?.type || !ts.isTypeLiteralNode(target.type)) continue;
        const members = target.type.members.filter(member => ts.isPropertySignature(member) && keep(member));
        tables.set(name(table, sourceFile), new Set(members.map(member => name(member, sourceFile))));
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

const unwrap = node => {
  let current = node;
  while (
    current &&
    (ts.isParenthesizedExpression(current) || ts.isAsExpression(current) || ts.isNonNullExpression(current))
  ) {
    current = current.expression;
  }
  return current;
};

/** Wörtlicher String-Wert einer Objekteigenschaft; Spreads und Variablen bleiben offen. */
function literalPropertyValue(object, propertyName) {
  if (!ts.isObjectLiteralExpression(object)) return undefined;
  for (const property of object.properties) {
    if (!ts.isPropertyAssignment(property)) continue;
    const key = ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)
      ? property.name.text
      : undefined;
    if (key !== propertyName) continue;
    const value = unwrap(property.initializer);
    if (!value) return undefined;
    return ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value) ? value.text : undefined;
  }
  return undefined;
}

/** Rückgabeausdrücke eines Funktionskörpers, ohne verschachtelte Funktionen. */
function returnExpressions(body) {
  const expression = unwrap(body);
  if (!expression) return [];
  if (!ts.isBlock(expression)) return [expression];
  const found = [];
  const visit = node => {
    if (ts.isFunctionLike(node) && node !== body) return;
    if (ts.isReturnStatement(node) && node.expression) found.push(node.expression);
    ts.forEachChild(node, visit);
  };
  visit(expression);
  return found;
}

/** Namen der ersten Parameter einer Callback-Funktion. */
function firstParameterName(fn) {
  const parameter = fn.parameters?.[0];
  if (!parameter) return undefined;
  return ts.isIdentifier(parameter.name) ? parameter.name.text : undefined;
}

/**
 * Schlüssel eines Objektliterals inklusive aufgelöster Spreads.
 * `unresolved` bleibt true, wenn ein Spread nicht bestimmbar ist.
 */
function objectKeys(node, ctx) {
  const keys = new Set();
  let unresolved = false;
  for (const property of node.properties) {
    if (ts.isSpreadAssignment(property)) {
      const spread = keysOfExpression(property.expression, ctx);
      if (spread) {
        for (const key of spread.keys) keys.add(key);
        if (spread.unresolved) unresolved = true;
      } else {
        unresolved = true;
      }
      continue;
    }
    const key = property.name?.getText(ctx.sourceFile)?.replace(/^['"](.*)['"]$/, '$1');
    if (key) keys.add(key);
  }
  return { keys, unresolved };
}

/** Schlüssel, die ein Ausdruck zu Zeilen beiträgt (Objekt, Array, Konstante, Parameter). */
function keysOfExpression(expression, ctx) {
  const node = unwrap(expression);
  if (!node) return undefined;
  if (ts.isObjectLiteralExpression(node)) {
    const { keys, unresolved } = objectKeys(node, ctx);
    return { keys, unresolved };
  }
  if (ts.isArrayLiteralExpression(node)) {
    // Ein leeres Array trägt keine Spalteninformation; Zeilen entstehen später
    // per push. Als unaufgelöst behandeln, sonst meldet der Check falsche
    // fehlende Pflichtspalten (z. B. check-egress-anomaly).
    if (node.elements.length === 0) return { keys: new Set(), unresolved: true };
    const keys = new Set();
    let unresolved = false;
    for (const element of node.elements) {
      if (ts.isSpreadElement(element)) {
        const spread = keysOfExpression(element.expression, ctx);
        if (!spread) { unresolved = true; continue; }
        for (const key of spread.keys) keys.add(key);
        if (spread.unresolved) unresolved = true;
        continue;
      }
      const entry = keysOfExpression(element, ctx);
      if (!entry) { unresolved = true; continue; }
      for (const key of entry.keys) keys.add(key);
      if (entry.unresolved) unresolved = true;
    }
    return { keys, unresolved };
  }
  if (ts.isIdentifier(node)) {
    const fromParameter = ctx.parameters.get(node.text);
    if (fromParameter) return fromParameter;
    const target = ctx.bindings.get(node.text);
    if (target) return keysOfExpression(target, { ...ctx, bindings: ctx.bindings });
    return undefined;
  }
  return undefined;
}

/** Sammelt die Objektliterale, die tatsächlich als Zeilen geschrieben werden. */
function collectRowObjects(expression, ctx, result, depth = 0) {
  const node = unwrap(expression);
  if (!node || depth > 8) {
    result.unresolved = true;
    return;
  }
  if (ts.isArrayLiteralExpression(node)) {
    for (const element of node.elements) {
      collectRowObjects(ts.isSpreadElement(element) ? element.expression : element, ctx, result, depth + 1);
    }
    return;
  }
  if (ts.isConditionalExpression(node)) {
    collectRowObjects(node.whenTrue, ctx, result, depth + 1);
    collectRowObjects(node.whenFalse, ctx, result, depth + 1);
    return;
  }
  if (ts.isObjectLiteralExpression(node)) {
    // Kontext mitnehmen: Spreads verweisen auf Callback-Parameter.
    result.objects.push({ node, ctx });
    return;
  }
  if (ts.isCallExpression(node)) {
    const callee = unwrap(node.expression);
    if (ts.isPropertyAccessExpression(callee) && callee.name.getText(ctx.sourceFile) === 'map' && node.arguments.length > 0) {
      const callback = unwrap(node.arguments[0]);
      if (callback && (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback))) {
        // Der Callback-Parameter trägt die Schlüssel der Quellelemente.
        const sourceKeys = keysOfExpression(callee.expression, ctx);
        const parameter = firstParameterName(callback);
        const inner = {
          ...ctx,
          parameters: new Map(ctx.parameters),
        };
        if (parameter) inner.parameters.set(parameter, sourceKeys ?? { keys: new Set(), unresolved: true });
        for (const returned of returnExpressions(callback.body)) {
          collectRowObjects(returned, inner, result, depth + 1);
        }
        return;
      }
      result.unresolved = true;
      return;
    }
    if (ts.isIdentifier(callee)) {
      const target = ctx.bindings.get(callee.text);
      if (target) {
        if (ts.isArrowFunction(target) || ts.isFunctionExpression(target)) {
          for (const returned of returnExpressions(target.body)) {
            collectRowObjects(returned, ctx, result, depth + 1);
          }
          return;
        }
        for (const returned of returnExpressions(target)) {
          collectRowObjects(returned, ctx, result, depth + 1);
        }
        return;
      }
    }
    result.unresolved = true;
    return;
  }
  result.unresolved = true;
}

/** Symboltabelle derselben Datei: Variablen-Initialisierer und Funktionskörper. */
function sameFileBindings(sourceFile) {
  const bindings = new Map();
  const add = (key, value) => {
    if (key && !bindings.has(key)) bindings.set(key, value);
  };
  const visit = node => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      add(node.name.text, node.initializer);
    }
    if (ts.isFunctionDeclaration(node) && node.name && node.body) add(node.name.text, node.body);
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return bindings;
}

/** Zeilenargument einer Schreiboperation, auch bei safeInsert(client, "tabelle", zeilen). */
function rowArgument(call, sourceFile) {
  const callee = call.expression;
  if (ts.isPropertyAccessExpression(callee) && WRITE_METHODS.has(callee.name.getText(sourceFile))) {
    return { node: call.arguments[0], method: callee.name.getText(sourceFile), table: tableOfCall(callee.expression, sourceFile) };
  }
  if (ts.isIdentifier(callee) && ROW_HELPERS.has(callee.text) && call.arguments.length >= 3) {
    const table = call.arguments[1];
    return {
      node: call.arguments[2],
      method: callee.text,
      table: table && ts.isStringLiteralLike(table) ? table.text : undefined,
    };
  }
  return undefined;
}

/** Alle Spaltenverstöße und Warnungen einer Datei. */
export function collectWriteFindings(source, fileName, tableColumns, requiredColumns = new Map()) {
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true);
  const bindings = sameFileBindings(sourceFile);
  const violations = [];
  const warnings = [];

  const visit = node => {
    if (ts.isCallExpression(node)) {
      const write = rowArgument(node, sourceFile);
      if (write) {
        const { table, method } = write;
        const columns = table ? tableColumns.get(table) : undefined;
        if (!table) {
          warnings.push({ file: fileName, line: lineOf(node, sourceFile), message: 'Tabelle ist ein Parameter; Zeilen nicht prüfbar' });
        } else if (!columns) {
          // Tabelle ohne generierte Typen (z. B. neue Migration) – nichts zu prüfen.
        } else {
          const result = { objects: [], unresolved: false };
          collectRowObjects(write.node, { sourceFile, bindings, parameters: new Map() }, result);
          // Zeilen aus importierten Buildern werden im jeweiligen Modul geprüft.
          const firstNode = unwrap(write.node);
          const head = firstNode && ts.isArrayLiteralExpression(firstNode) ? unwrap(firstNode.elements[0]) : firstNode;
          const importedBuilder = Boolean(
            head &&
            ts.isCallExpression(head) &&
            ts.isIdentifier(head.expression) &&
            !bindings.has(head.expression.text),
          );
          for (const { node: object, ctx } of result.objects) {
            const { keys, unresolved } = objectKeys(object, ctx);
            for (const column of keys) {
              if (!columns.has(column)) violations.push({ file: fileName, table, method, column, kind: 'unbekannt' });
            }
            const required = method === 'update' ? undefined : requiredColumns.get(table);
            if (required && !unresolved) {
              for (const column of required) {
                if (!keys.has(column)) violations.push({ file: fileName, table, method, column, kind: 'pflicht' });
              }
            }
            // Statuswerte prüft nur tasks: andere Tabellen (task_decisions,
            // appointment_requests, …) führen eigene Statusmengen.
            if (table === 'tasks') {
              const status = literalPropertyValue(object, 'status');
              if (status !== undefined && !CORE_TASK_STATUS_KEYS.includes(status)) {
                violations.push({ file: fileName, table, method, column: status, kind: 'status' });
              }
            }
            if (unresolved) {
              warnings.push({
                file: fileName,
                line: lineOf(object, sourceFile),
                message: `${table}: Teile der Zeile sind dynamisch (Spread) und nicht prüfbar`,
              });
            }
          }
          if (result.unresolved) {
            warnings.push({
              file: fileName,
              line: lineOf(node, sourceFile),
              message: importedBuilder
                ? `${table}: Zeilen stammen aus einem importierten Builder (im Modul geprüft)`
                : `${table}: Zeilen sind dynamisch und nicht prüfbar`,
            });
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return { violations, warnings };
}

const lineOf = (node, sourceFile) => sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;

/** Alte Signatur: nur Verstöße, ohne Warnungen. */
export function collectColumnViolations(source, fileName, tableColumns, requiredColumns = new Map()) {
  return collectWriteFindings(source, fileName, tableColumns, requiredColumns).violations;
}

/**
 * Liest Typen, Edge Functions und geteilte Module und liefert das Ergebnis.
 * Ohne explizite Auswahl gelten alle Funktionen und alle geteilten Module;
 * eine übergebene Liste prüft nur diese Funktionen (Fixtures, Einzelfälle).
 */
export function collectReport(root = process.cwd(), functions, options = {}) {
  const selected = functions ?? listFunctions(root);
  const includeShared = options.shared ?? functions === undefined;
  const typesSource = readFileSync(join(root, TYPES_FILE), 'utf8');
  const tableColumns = parseTableColumns(typesSource);
  const requiredColumns = parseTableInsertRequirements(typesSource);

  const functionFiles = selected.map(entry => `${FUNCTIONS_ROOT}/${entry}/index.ts`);
  const sharedFiles = includeShared
    ? listSharedModules(root).map(entry => `${SHARED_ROOT}/${entry}`)
    : [];

  const files = [...functionFiles, ...sharedFiles];
  const violations = [];
  const warnings = [];
  for (const file of files) {
    let source;
    try {
      source = readFileSync(join(root, file), 'utf8');
    } catch {
      violations.push({ file, table: '—', method: '—', column: 'Funktion nicht gefunden', kind: 'datei' });
      continue;
    }
    const findings = collectWriteFindings(source, file, tableColumns, requiredColumns);
    violations.push(...findings.violations);
    warnings.push(...findings.warnings);
  }
  return { files, functionFiles, sharedFiles, violations, warnings };
}

export function renderReport({ files, functionFiles = [], sharedFiles = [], violations, warnings = [] }) {
  const lines = [
    `Geprüfte Dateien: ${files.length} (${functionFiles.length} Funktionen, ${sharedFiles.length} geteilte Module)`,
  ];
  for (const violation of violations) {
    lines.push(
      violation.kind === 'status'
        ? `${violation.file}: ${violation.method} auf ${violation.table} schreibt nicht registrierten Status "${violation.column}" (Kernstatus: ${CORE_TASK_STATUS_HINT})`
        : violation.kind === 'pflicht'
          ? `${violation.file}: ${violation.method} auf ${violation.table} ohne Pflichtspalte "${violation.column}"`
          : `${violation.file}: ${violation.method} auf ${violation.table} schreibt unbekannte Spalte "${violation.column}"`,
    );
  }
  for (const warning of warnings) {
    lines.push(`Hinweis: ${warning.file}:${warning.line} – ${warning.message}`);
  }
  if (violations.length > 0) {
    lines.push('Spalte in einer Migration anlegen, Pflichtspalte ergänzen, einen Kernstatus verwenden oder den Schreibzugriff entfernen und die Typen neu generieren.');
  }
  return lines.join('\n');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const report = collectReport();
  console.log(`[edge-function-columns] ${renderReport(report)}`);
  process.exitCode = report.violations.length > 0 ? 1 : 0;
}
