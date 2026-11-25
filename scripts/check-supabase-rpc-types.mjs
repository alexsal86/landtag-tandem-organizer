#!/usr/bin/env node
// Stellt sicher, dass jede im Client per supabase.rpc("...") aufgerufene Funktion
// im Functions-Block von src/integrations/supabase/types.ts abgebildet ist.
// Ohne diesen Check fallen fehlende RPC-Typen nur auf, wenn ein Programm ohne
// den createClient-Any-Workaround (src/supabase-fix.d.ts) typgeprüft wird.
import { readFileSync, readdirSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

export const TYPES_FILE = 'src/integrations/supabase/types.ts';
const SOURCE_ROOT = 'src';

const STRING_KINDS = new Set([ts.SyntaxKind.StringLiteral, ts.SyntaxKind.NoSubstitutionTemplateLiteral]);

function unwrap(node) {
  let current = node;
  while (
    current &&
    (ts.isParenthesizedExpression(current) ||
      ts.isAsExpression(current) ||
      ts.isNonNullExpression(current) ||
      ts.isTypeAssertionExpression(current))
  ) {
    current = current.expression;
  }
  return current;
}

/** Liest die Funktionsnamen aus dem Functions-Block der generierten Database-Typen. */
export function parseFunctionNames(source, fileName = TYPES_FILE) {
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true);
  const names = new Set();
  const visit = node => {
    const isFunctionsMember =
      (ts.isPropertySignature(node) || ts.isPropertyAssignment(node)) &&
      node.name &&
      node.name.getText(sourceFile) === 'Functions';
    if (isFunctionsMember) {
      // In types.ts steht der Block als Typ-Literal (PropertySignature), in Fixtures auch als Objekt-Literal.
      const body = ts.isPropertySignature(node) ? node.type : node.initializer;
      if (body && (ts.isTypeLiteralNode(body) || ts.isObjectLiteralExpression(body))) {
        const members = ts.isTypeLiteralNode(body) ? body.members : body.properties;
        for (const member of members) {
          if (member.name && (ts.isIdentifier(member.name) || ts.isStringLiteral(member.name))) {
            names.add(member.name.text);
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return names;
}

function stringConstants(sourceFile) {
  const constants = new Map();
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || !declaration.initializer) continue;
      const initializer = unwrap(declaration.initializer);
      if (initializer && STRING_KINDS.has(initializer.kind)) {
        constants.set(declaration.name.text, initializer.text);
      }
    }
  }
  return constants;
}

function rpcNames(node, constants) {
  const expression = unwrap(node);
  if (!expression) return [];
  if (STRING_KINDS.has(expression.kind)) return [expression.text];
  if (ts.isIdentifier(expression)) return constants.has(expression.text) ? [constants.get(expression.text)] : [];
  if (ts.isConditionalExpression(expression)) {
    return [...rpcNames(expression.whenTrue, constants), ...rpcNames(expression.whenFalse, constants)];
  }
  return [];
}

/** Sammelt supabase.rpc-Aufrufe mit auflösbarem Namen; dynamische Namen landen in `unresolved`. */
export function parseClientCalls(source, fileName) {
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true);
  const constants = stringConstants(sourceFile);
  const calls = [];
  const unresolved = [];
  const visit = node => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'rpc'
    ) {
      const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
      const names = new Set(node.arguments.length ? rpcNames(node.arguments[0], constants) : []);
      if (names.size === 0) unresolved.push({ file: fileName, line });
      for (const name of names) calls.push({ name, file: fileName, line });
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return { calls, unresolved };
}

function sourceFiles(root) {
  const files = [];
  const walk = directory => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (/\.(ts|tsx)$/.test(entry.name)) files.push(path);
    }
  };
  walk(resolve(root, SOURCE_ROOT));
  return files.sort();
}

export function collectRpcTypeReport(root) {
  const absoluteRoot = resolve(root);
  const functions = parseFunctionNames(readFileSync(resolve(absoluteRoot, TYPES_FILE), 'utf8'));
  const calls = [];
  const unresolved = [];
  for (const file of sourceFiles(absoluteRoot)) {
    const fileName = relative(absoluteRoot, file).replaceAll('\\', '/');
    const parsed = parseClientCalls(readFileSync(file, 'utf8'), fileName);
    calls.push(...parsed.calls);
    unresolved.push(...parsed.unresolved);
  }
  const referenced = [...new Set(calls.map(call => call.name))].sort();
  const missing = referenced.filter(name => !functions.has(name));
  return {
    functions: [...functions].sort(),
    referenced,
    calls,
    unresolved,
    missing,
  };
}

export function renderReport(report) {
  const lines = [];
  if (report.missing.length > 0) {
    lines.push('Fehlende Supabase-RPC-Typen in src/integrations/supabase/types.ts:');
    for (const name of report.missing) {
      const locations = [
        ...new Set(report.calls.filter(call => call.name === name).map(call => `${call.file}:${call.line}`)),
      ];
      lines.push(`  - ${name} (${locations.join(', ')})`);
    }
    lines.push('Ergänze die Funktion im Functions-Block mit Args/Returns nach der SQL-Signatur.');
  } else {
    lines.push(
      `[supabase-rpc-types] ${report.referenced.length} RPC-Namen aus ${report.calls.length} Aufrufen sind in types.ts abgebildet.`,
    );
  }
  if (report.unresolved.length > 0) {
    const locations = report.unresolved.map(entry => `${entry.file}:${entry.line}`).join(', ');
    lines.push(`${report.unresolved.length} Aufruf(e) mit dynamischem Namen bleiben ungeprüft: ${locations}`);
  }
  return lines.join('\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = collectRpcTypeReport(process.cwd());
  console.log(renderReport(report));
  if (report.missing.length > 0) process.exitCode = 1;
}
