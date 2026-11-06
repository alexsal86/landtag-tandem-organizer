#!/usr/bin/env node
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const parse = (path) => ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true);
const name = (node) => node?.name && (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)) ? node.name.text : undefined;
const property = (node, key) => node?.members?.find(m => name(m) === key) ?? node?.properties?.find(m => name(m) === key);
function literal(node) {
  if (!node) return undefined;
  if (ts.isStringLiteral(node)) return node.text;
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(literal);
  if (ts.isObjectLiteralExpression(node)) return Object.fromEntries(node.properties.filter(ts.isPropertyAssignment).map(p => [name(p), literal(p.initializer)]));
  if (ts.isAsExpression(node) || ts.isSatisfiesExpression(node)) return literal(node.expression);
  return undefined;
}
function variables(source) {
  return source.statements.filter(ts.isVariableStatement).flatMap(s => s.declarationList.declarations);
}

export function collectCoverage(root) {
  const schema = parse(join(root, 'src/integrations/supabase/types.ts'));
  const database = schema.statements.find(s => ts.isTypeAliasDeclaration(s) && s.name.text === 'Database');
  const tableType = property(property(database?.type, 'public')?.type, 'Tables')?.type;
  if (!tableType?.members) throw new Error('Public-Tabellen konnten nicht aus den Supabase-Typen gelesen werden.');
  const tables = tableType.members.map(name).filter(Boolean).sort();
  const config = variables(parse(join(root, 'src/features/selftest/coverage-config.ts')));
  const ignored = new Set(literal(config.find(v => v.name.getText() === 'IGNORED_TABLES')?.initializer));
  const deferred = new Set(literal(config.find(v => v.name.getText() === 'DEFERRED_TABLES')?.initializer));
  const registry = parse(join(root, 'src/features/selftest/registry.ts'));
  const registered = new Set();
  const scenarioArray = variables(registry).find(v => v.name.getText() === 'SELFTEST_SCENARIOS')?.initializer;
  if (!scenarioArray || !ts.isArrayLiteralExpression(scenarioArray)) throw new Error('Szenario-Registry fehlt.');
  const registeredNames = new Set(scenarioArray.elements.map(e => e.getText()));
  for (const statement of registry.statements.filter(ts.isImportDeclaration)) {
    const bindings = statement.importClause?.namedBindings;
    if (bindings && ts.isNamedImports(bindings) && bindings.elements.some(e => registeredNames.has(e.name.text))) registered.add(`${statement.moduleSpecifier.text.split('/').pop()}.ts`);
  }
  const directory = join(root, 'src/features/selftest/scenarios');
  const scenarios = readdirSync(directory).filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts')).map(file => {
    const declaration = variables(parse(join(directory, file))).find(v => ts.isObjectLiteralExpression(v.initializer) && property(v.initializer, 'touches'));
    const result = literal(declaration?.initializer);
    if (!result?.id || !Array.isArray(result.touches)) throw new Error(`Ungültiges Szenario: ${file}`);
    return { id: result.id, title: result.title, touches: result.touches, features: result.features ?? [], writes: result.writes ?? [], registered: registered.has(file) };
  }).sort((a, b) => a.id.localeCompare(b.id));
  const rows = tables.map(table => {
    const scenarioIds = scenarios.filter(s => s.registered && s.touches.includes(table)).map(s => s.id);
    return { table, status: scenarioIds.length ? 'scenario' : deferred.has(table) ? 'deferred' : ignored.has(table) ? 'excluded' : 'missing', scenarios: scenarioIds };
  });
  const errors = [
    ...scenarios.filter(s => !s.registered).map(s => `Nicht registriertes Szenario: ${s.id}`),
    ...scenarios.flatMap(s => s.touches.filter(t => !tables.includes(t)).map(t => `Unbekannte Tabelle ${t} in ${s.id}`)),
    ...rows.filter(r => r.status === 'missing').map(r => `Neue Tabelle ohne Einordnung: ${r.table}`),
  ];
  return { schemaVersion: 1, source: 'src/integrations/supabase/types.ts',
    counts: { total: tables.length, scenario: rows.filter(r => r.status === 'scenario').length,
      deferred: rows.filter(r => r.status === 'deferred').length, excluded: rows.filter(r => r.status === 'excluded').length, missing: rows.filter(r => r.status === 'missing').length },
    scenarios, tables: rows, errors };
}

export function renderCoverage(report) {
  const labels = { scenario: 'Szenario vorhanden', deferred: 'Ausstehend', excluded: 'Ausgenommen (nicht geprüft)', missing: 'Einordnung fehlt' };
  return `# Selbsttest-Abdeckung\n\n_Auto-generiert mit \`npm run update:selftest-coverage\`._\n\n` +
    `Quelle: \`${report.source}\`. Die Angaben beschreiben deklarierte Prüfumfänge, keine erfolgreichen Testläufe und keine Code-Coverage.\n\n` +
    `Von ${report.counts.total} Tabellen haben ${report.counts.scenario} ein registriertes Szenario. ${report.counts.deferred} sind als Ausbau offen, ${report.counts.excluded} ausgenommen und ${report.counts.missing} noch nicht eingeordnet. Ausnahmen zählen nicht als bestanden.\n\n` +
    `## Szenarien\n\n| ID | Titel | Tabellen |\n|---|---|---|\n` + report.scenarios.map(s => `| \`${s.id}\` | ${s.title} | ${s.touches.join(', ') || 'Keine (reine Regeln)'} |`).join('\n') +
    `\n\n## Tabellen\n\n| Tabelle | Einordnung | Szenarien |\n|---|---|---|\n` + report.tables.map(r => `| \`${r.table}\` | ${labels[r.status]} | ${r.scenarios.join(', ') || '—'} |`).join('\n') +
    `\n\n## Deklarierte Schreibfelder\n\nDiese Manifeste sind keine Messung ausgeführter Assertions.\n\n` + report.scenarios.flatMap(s => s.writes.filter(Boolean).map(w => `- ${s.id}: \`${w.table}\`: ${(w.columns ?? []).join(', ')}`)).join('\n') + '\n';
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  const root = process.cwd();
  const report = collectCoverage(root);
  const files = new Map([
    ['docs/selftest-coverage.md', renderCoverage(report)],
    ['src/features/selftest/coverage-summary.json', JSON.stringify(report, null, 2) + '\n'],
    ['src/features/selftest/__schema-snapshot__/public-tables.json', JSON.stringify(report.tables.map(r => r.table), null, 2) + '\n'],
  ]);
  const errors = [...report.errors];
  for (const [file, expected] of files) {
    if (process.argv.includes('--write')) writeFileSync(join(root, file), expected);
    else {
      let actual;
      try { actual = readFileSync(join(root, file), 'utf8'); } catch { /* fehlt */ }
      if (actual !== expected) errors.push(`${file} ist veraltet. npm run update:selftest-coverage ausführen.`);
    }
  }
  console.log('[selftest-coverage]', report.counts);
  for (const error of errors) console.error(error);
  process.exitCode = errors.length ? 1 : 0;
}
