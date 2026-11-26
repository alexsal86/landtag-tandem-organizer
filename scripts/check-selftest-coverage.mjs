#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
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

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const endOfDay = (day) => new Date(`${day}T23:59:59.999Z`);

export function collectCoverage(root, { today = new Date() } = {}) {
  const schema = parse(join(root, 'src/integrations/supabase/types.ts'));
  const database = schema.statements.find(s => ts.isTypeAliasDeclaration(s) && s.name.text === 'Database');
  const tableType = property(property(database?.type, 'public')?.type, 'Tables')?.type;
  if (!tableType?.members) throw new Error('Public-Tabellen konnten nicht aus den Supabase-Typen gelesen werden.');
  const tables = tableType.members.map(name).filter(Boolean).sort();
  const config = variables(parse(join(root, 'src/features/selftest/coverage-config.ts')));
  const exceptionGroups = literal(config.find(v => v.name.getText() === 'COVERAGE_EXCEPTIONS')?.initializer);
  if (!Array.isArray(exceptionGroups)) throw new Error('COVERAGE_EXCEPTIONS fehlt oder ist kein Array.');
  const exceptions = new Map();
  const exceptionSummaries = [];
  const exceptionErrors = [];
  for (const group of exceptionGroups) {
    const kind = group?.kind;
    const reason = typeof group?.reason === 'string' ? group.reason.trim() : '';
    const expiresOn = typeof group?.expiresOn === 'string' ? group.expiresOn : '';
    const groupTables = Array.isArray(group?.tables) ? group.tables : [];
    const label = groupTables.length ? groupTables.join(', ') : '(ohne Tabellen)';
    if (kind !== 'excluded' && kind !== 'deferred') {
      exceptionErrors.push(`Ausnahme ohne gültige Art (excluded/deferred): ${label}`);
      continue;
    }
    if (reason.length < 20) exceptionErrors.push(`Ausnahme ohne ausreichende Begründung (mindestens 20 Zeichen): ${label}`);
    if (!ISO_DAY.test(expiresOn) || Number.isNaN(endOfDay(expiresOn).getTime())) {
      exceptionErrors.push(`Ausnahme ohne gültiges Ablaufdatum (YYYY-MM-DD): ${label}`);
    } else if (endOfDay(expiresOn).getTime() < today.getTime()) {
      exceptionErrors.push(`Ausnahme abgelaufen am ${expiresOn}: ${label}`);
    }
    if (!groupTables.length) exceptionErrors.push(`Ausnahmegruppe ohne Tabellen: ${reason || '(ohne Begründung)'}`);
    for (const table of groupTables) {
      if (exceptions.has(table)) {
        exceptionErrors.push(`Tabelle ${table} ist mehrfach als Ausnahme eingetragen.`);
        continue;
      }
      exceptions.set(table, { kind, reason, expiresOn });
    }
    exceptionSummaries.push({ kind, reason, expiresOn, tables: groupTables });
  }
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
    const exception = scenarioIds.length ? null : exceptions.get(table) ?? null;
    return { table, status: scenarioIds.length ? 'scenario' : exception ? exception.kind : 'missing', scenarios: scenarioIds,
      exception: exception ? { kind: exception.kind, expiresOn: exception.expiresOn } : null };
  });
  const inventory = join(root, 'src/features/feature-catalog/inventory');
  const uncoveredFeatures = existsSync(inventory)
    ? readdirSync(inventory).filter(file => file.endsWith('.json')).flatMap(file => {
        const area = JSON.parse(readFileSync(join(inventory, file), 'utf8'));
        return (area.features ?? [])
          .filter(feature => feature.category === 'fachlich' && feature.implementationStatus === 'implementiert' && feature.coverage === 'keine')
          .map(feature => ({ id: feature.id, name: feature.name, area: area.area?.id ?? file.replace(/\.json$/, ''), tables: feature.tables ?? [] }));
      }).sort((a, b) => a.id.localeCompare(b.id))
    : [];
  const errors = [
    ...exceptionErrors,
    ...scenarios.filter(s => !s.registered).map(s => `Nicht registriertes Szenario: ${s.id}`),
    ...scenarios.flatMap(s => s.touches.filter(t => !tables.includes(t)).map(t => `Unbekannte Tabelle ${t} in ${s.id}`)),
    ...[...exceptions.keys()].filter(t => !tables.includes(t)).map(t => `Ausnahme für unbekannte Tabelle: ${t}`),
    ...rows.filter(r => r.status === 'scenario' && exceptions.has(r.table))
      .map(r => `Ausnahme für ${r.table} ist überflüssig: bereits durch ${r.scenarios.join(', ')} gedeckt.`),
    ...rows.filter(r => r.status === 'missing').map(r => `Neue Tabelle ohne Einordnung: ${r.table}`),
  ];
  return { schemaVersion: 2, source: 'src/integrations/supabase/types.ts',
    counts: { total: tables.length, scenario: rows.filter(r => r.status === 'scenario').length,
      deferred: rows.filter(r => r.status === 'deferred').length, excluded: rows.filter(r => r.status === 'excluded').length,
      missing: rows.filter(r => r.status === 'missing').length, exceptions: rows.filter(r => !!r.exception).length },
    exceptionGroups: exceptionSummaries, scenarios, tables: rows, uncoveredFeatures, errors };
}

export function renderCoverage(report) {
  const statusLabel = (row) => {
    if (row.status === 'scenario') return 'Szenario vorhanden';
    if (row.status === 'missing') return 'Einordnung fehlt';
    const expiry = row.exception?.expiresOn ?? '—';
    return row.status === 'excluded' ? `Ausgenommen bis ${expiry}` : `Ausstehend bis ${expiry}`;
  };
  const exceptionRows = (report.exceptionGroups ?? []).map(group => {
    const scope = group.tables.length <= 5 ? group.tables.map(table => `\`${table}\``).join(', ') : `${group.tables.length} Tabellen`;
    return `| ${group.kind === 'excluded' ? 'Ausgenommen' : 'Ausstehend'} | ${group.expiresOn} | ${scope} | ${group.reason} |`;
  }).join('\n');
  const featureRows = (report.uncoveredFeatures ?? []).map(feature =>
    `| \`${feature.id}\` | ${feature.name} | ${feature.area} | ${feature.tables.join(', ') || '—'} |`).join('\n');
  return `# Selbsttest-Abdeckung\n\n_Auto-generiert mit \`npm run update:selftest-coverage\`._\n\n` +
    `Quelle: \`${report.source}\`. Die Angaben beschreiben deklarierte Prüfumfänge, keine erfolgreichen Testläufe und keine Code-Coverage.\n\n` +
    `Von ${report.counts.total} Tabellen haben ${report.counts.scenario} ein registriertes Szenario; ${report.counts.missing} sind noch nicht eingeordnet. ${report.counts.exceptions} sind befristet ausgenommen, davon ${report.counts.deferred} als Ausbau offen und ${report.counts.excluded} als technisch oder fachlich ausgenommen. Ausnahmen zählen nicht als bestanden.\n\n` +
    `## Szenarien\n\n| ID | Titel | Tabellen |\n|---|---|---|\n` + report.scenarios.map(s => `| \`${s.id}\` | ${s.title} | ${s.touches.join(', ') || 'Keine (reine Regeln)'} |`).join('\n') +
    `\n\n## Tabellen\n\n| Tabelle | Einordnung | Szenarien |\n|---|---|---|\n` + report.tables.map(r => `| \`${r.table}\` | ${statusLabel(r)} | ${r.scenarios.join(', ') || '—'} |`).join('\n') +
    `\n\n## Befristete Ausnahmen\n\nJede Ausnahme verlangt eine Begründung und ein Ablaufdatum. Abgelaufene, unbegründete oder bereits durch ein Szenario gedeckte Ausnahmen lassen \`check:selftest-coverage\` fehlschlagen.\n\n| Art | Gültig bis | Umfang | Begründung |\n|---|---|---|---|\n` + (exceptionRows || '| — | — | 0 | Keine Ausnahmen. |') +
    `\n\n## Fachfunktionen ohne Selbsttest\n\nDiese implementierten Fachfunktionen haben laut Funktionskatalog keine Selbsttest-Abdeckung — unabhängig davon, ob einzelne Tabellen von anderen Szenarien berührt werden.\n\n| Funktion | Name | Bereich | Tabellen |\n|---|---|---|---|\n` + (featureRows || '| — | — | — | — |') +
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
  console.log(`[selftest-coverage] Fachfunktionen ohne Selbsttest: ${report.uncoveredFeatures.length}`);
  for (const error of errors) console.error(error);
  process.exitCode = errors.length ? 1 : 0;
}
